import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs'; // NEW: File System module to save data permanently

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve React App
app.use(express.static(path.join(__dirname, 'dist')));

// 1. PERSISTENT FILE STORAGE
const DATA_FILE = path.join(__dirname, 'users.json');
let trackedUsers = {};

// Load existing data from the file when the server starts
if (fs.existsSync(DATA_FILE)) {
  try {
    trackedUsers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    // Mark everyone as offline initially upon server reboot
    Object.keys(trackedUsers).forEach(id => {
      trackedUsers[id].status = 'offline';
    });
    console.log(`✅ Loaded ${Object.keys(trackedUsers).length} saved users from database.`);
  } catch (err) {
    console.error("❌ Failed to load users.json:", err);
  }
}

// Helper function to save data to the file
const saveUsersToFile = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(trackedUsers, null, 2));
  } catch (err) {
    console.error("❌ Failed to save to users.json:", err);
  }
};

// 2. TELEGRAM NOTIFICATIONS
const sendTelegramAlert = async (name, lat, lng) => {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8675032884:AAHwrxfA52fcHK69LxDY3q9jem8Ky-aw4Hs';
  const chatId = process.env.TELEGRAM_CHAT_ID || '6670686940';
  
  if (!token || !chatId) return;

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const message = `🚨 *FROOZY ALERT* 🚨\n\n*${name}* is active!\n\n📍 [View on Google Maps](${mapsUrl})`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
    
    const data = await response.json();
    if (!data.ok) {
      console.log("❌ TELEGRAM API REJECTED IT:", data.description);
    }
  } catch (err) {
    console.error("❌ NODEJS FETCH ERROR:", err.message);
  }
};

io.on('connection', (socket) => {
  
  // Immediately send current data when an Admin connects/refreshes
  socket.emit('users-list', Object.values(trackedUsers));

  socket.on('update-location', (userData) => {
    const isNewSession = !trackedUsers[userData.userId] || trackedUsers[userData.userId].status === 'offline';
    
    // Preserve the user's custom name if it was edited by the admin
    const existingName = trackedUsers[userData.userId]?.name;
    const finalName = existingName || userData.name;

    trackedUsers[userData.userId] = { 
      ...userData, 
      name: finalName,
      lastSeen: Date.now(),
      status: 'online'
    };

    saveUsersToFile(); // Save updated location to file

    if (isNewSession) {
      sendTelegramAlert(finalName, userData.lat, userData.lng);
    }

    io.emit('users-list', Object.values(trackedUsers));
  });

  // Handle editing a user's name
  socket.on('edit-user-name', ({ userId, newName }) => {
    if (trackedUsers[userId]) {
      trackedUsers[userId].name = newName;
      saveUsersToFile(); // Save name change to file
      io.emit('users-list', Object.values(trackedUsers));
    }
  });

  // Handle completely deleting a user
  socket.on('delete-user', (userId) => {
    if (trackedUsers[userId]) {
      delete trackedUsers[userId];
      saveUsersToFile(); // Save deletion to file
      io.emit('users-list', Object.values(trackedUsers));
    }
  });
});

// Periodic cleanup: Mark as offline if no ping in 2 minutes
setInterval(() => {
  const now = Date.now();
  let stateChanged = false;
  
  Object.keys(trackedUsers).forEach(id => {
    if (trackedUsers[id].status === 'online' && (now - trackedUsers[id].lastSeen > 120000)) {
      trackedUsers[id].status = 'offline'; 
      stateChanged = true;
    }
  });
  
  if (stateChanged) {
    saveUsersToFile(); // Save offline statuses to file
    io.emit('users-list', Object.values(trackedUsers));
  }
}, 10000);

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
