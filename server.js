import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'dist')));

// Persistent store: { userId: { name, lat, lng, lastSeen } }
let activeUsers = {};

io.on('connection', (socket) => {
  socket.on('update-location', (userData) => {
    // Store by the custom userId from the frontend, not socket.id
    activeUsers[userData.userId] = { 
      ...userData, 
      lastSeen: Date.now() 
    };
    io.emit('users-list', Object.values(activeUsers));
  });

  // Clean up users who haven't sent a location in 5 minutes (stale data)
  socket.on('disconnect', () => {
    // We don't delete immediately anymore! 
    // This allows for refreshes.
  });
});

// Periodic cleanup of "ghost" users (inactive for > 5 mins)
setInterval(() => {
  const now = Date.now();
  Object.keys(activeUsers).forEach(id => {
    if (now - activeUsers[id].lastSeen > 300000) {
      delete activeUsers[id];
    }
  });
  io.emit('users-list', Object.values(activeUsers));
}, 10000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
