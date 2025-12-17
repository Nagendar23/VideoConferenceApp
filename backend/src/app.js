// backend/app.js
import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';

import userRoutes from './routes/users.routes.js';

const app = express();
const server = createServer(app);

// configure socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Vite dev server
    methods: ["GET", "POST"],
  },
});

// handle socket.io events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('message', (data) => {
    console.log('Message from client:', data);
    socket.emit('reply', `Server got your message: ${data}`);
  });

  socket.on("join-call", (path) => {
    if (io.sockets.adapter.rooms.get(path) === undefined) {
      socket.join(path);
      io.to(path).emit("user-joined", socket.id, []);
    } else {
      let clients = [...io.sockets.adapter.rooms.get(path)];
      socket.join(path);
      io.to(socket.id).emit("user-joined", socket.id, clients);
    }
  });

  socket.on("signal", (toId, message) => {
    io.to(toId).emit("signal", socket.id, message);
  });

  socket.on("chat-message", (data, sender) => {
    const match = data.match(/^@(\S+)\s+(.+)$/);
    if (match) {
      const targetUsername = match[1];
      const msg = match[2];
      const targetSocketId = Object.keys(io.sockets.sockets).find(
        id => io.sockets.sockets[id].username === targetUsername
      );
      if (targetSocketId) {
        io.to(targetSocketId).emit("chat-message", msg, sender);
      }
    } else {
      socket.broadcast.emit("chat-message", data, sender);
    }
  });

  socket.on("video-toggle", (isAvailable) => {
    // Broadcast this user's video state to everyone else in the rooms they are in
    // Since this is a simple broadcasting, we can just broadcast to "room" but we don't track rooms explicitly in 'socket' object without looking them up or passing it.
    // However, socket.rooms contains the rooms.
    const rooms = [...socket.rooms];
    rooms.forEach((room) => {
      socket.to(room).emit("video-toggle", socket.id, isAvailable);
    });
  });

  socket.on("disconnect", () => {
    // find which room the user was in??
    // socket.io automatically leaves rooms on disconnect.
    // However, we might want to notify others in those rooms.
    // 'disconnecting' event gives access to socket.rooms BEFORE they are left.
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((room) => {
      socket.to(room).emit("user-left", socket.id)
    })
  });
});

app.set('port', process.env.PORT || 8000);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/users', userRoutes);

const start = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  server.listen(app.get('port'), () => {
    console.log(`🚀 Server running on port ${app.get('port')}`);
  });
};

start();
