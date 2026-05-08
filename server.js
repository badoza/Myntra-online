import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Serve React App
app.use(express.static(path.join(__dirname, 'dist')));

// 1. PERSISTENT STORAGE (In-Memory)
let trackedUsers = {};

const sendTelegramAlert = async (name, lat, lng) => {
  // Using your provided credentials
  const token = process.env.TELEGRAM_BOT_TOKEN || '8675032884:AAHwrxfA52fcHK69LxDY3q9jem8Ky-aw4Hs';
  const chatId = process.env.TELEGRAM_CHAT_ID || '6670686940';
  
  console.log("🚨 TELEGRAM ALERT TRIGGERED FOR:", name);
  console.log("👉 Token Found in Render?", !!token);
  console.log("👉 Chat ID Found in Render?", !!chatId);

  if (!token || !chatId) {
    console.log("❌ ABORTING: Render Environment Variables are missing!");
    return;
  }

  // FIXED GOOGLE MAPS LINK: Properly formats the latitude and longitude
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  const message = `🚨 *FROOZY ALERT* 🚨\n\n*${name}* is active!\n\n📍 [View on Google Maps](${mapsUrl})`;

  try {
    console.log("📡 Sending message to Telegram API...");
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
    if (data.ok) {
      console.log("✅ TELEGRAM MESSAGE SENT SUCCESSFULLY!");
    } else {
      console.log("❌ TELEGRAM API REJECTED IT:", data.description);
    }
  } catch (err) {
    console.error("❌ NODEJS FETCH ERROR:", err.message);
  }
};

io.on('connection', (socket) => {
  socket.on('update-location', (userData) => {
    const isNewSession = !trackedUsers[userData.userId] || trackedUsers[userData.userId].status === 'offline';
    
    // Store/Update the user data
    trackedUsers[userData.userId] = { 
      ...userData, 
      lastSeen: Date.now(),
      status: 'online' // Mark as active
    };

    // If they just opened the link, send the alert to your phone
    if (isNewSession) {
      sendTelegramAlert(userData.name, userData.lat, userData.lng);
    }

    io.emit('users-list', Object.values(trackedUsers));
  });
});

// Periodic cleanup: Mark as offline if no ping in 2 minutes
setInterval(() => {
  const now = Date.now();
  let stateChanged = false;
  
  Object.keys(trackedUsers).forEach(id => {
    if (trackedUsers[id].status === 'online' && (now - trackedUsers[id].lastSeen > 120000)) {
      trackedUsers[id].status = 'offline'; // Keep the data, just mark offline
      stateChanged = true;
    }
  });
  
  if (stateChanged) {
    io.emit('users-list', Object.values(trackedUsers));
  }
}, 10000);

// Catch-all for React Router
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
