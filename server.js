import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'dist')));

// Store active users: { socketId: { id, name, lat, lng } }
const activeUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('update-location', (userData) => {
    activeUsers[socket.id] = { ...userData, id: socket.id };
    // Broadcast all users to everyone
    io.emit('users-list', Object.values(activeUsers));
  });

  socket.on('disconnect', () => {
    delete activeUsers[socket.id];
    io.emit('users-list', Object.values(activeUsers));
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
