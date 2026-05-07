import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Serve static files from the dist folder
app.use(express.static(path.join(__dirname, 'dist')));

let activeUsers = {};

io.on('connection', (socket) => {
  socket.on('update-location', (userData) => {
    activeUsers[userData.userId] = { 
      ...userData, 
      lastSeen: Date.now() 
    };
    io.emit('users-list', Object.values(activeUsers));
  });

  socket.on('disconnect', () => {
    // Keep users for 5 mins to handle refreshes
  });
});

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  Object.keys(activeUsers).forEach(id => {
    if (now - activeUsers[id].lastSeen > 300000) {
      delete activeUsers[id];
    }
  });
  io.emit('users-list', Object.values(activeUsers));
}, 10000);

// --- THE FIX IS HERE ---
// This "catch-all" route sends index.html for any request that doesn't match a file.
// This allows React to handle the /admin URL.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
