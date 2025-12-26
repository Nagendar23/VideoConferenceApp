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

  let activeScreenSharerId = null;

  socket.on("join-call", (path) => {
    if (io.sockets.adapter.rooms.get(path) === undefined) {
      socket.join(path);
      io.to(path).emit("user-joined", socket.id, []);
    } else {
      let clients = [...io.sockets.adapter.rooms.get(path)];
      socket.join(path);
      io.to(socket.id).emit("user-joined", socket.id, clients);

      // key change: tell the new user if someone is sharing
      if (activeScreenSharerId) {
        io.to(socket.id).emit("screen-share-started", activeScreenSharerId);
      }
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
    const rooms = [...socket.rooms];
    rooms.forEach((room) => {
      socket.to(room).emit("video-toggle", socket.id, isAvailable);
    });
  });

  socket.on("request-screen-share", () => {
    if (activeScreenSharerId === null || activeScreenSharerId === socket.id) {
      activeScreenSharerId = socket.id;
      // Broadcast to everyone including sender (for confirmation)
      const rooms = [...socket.rooms];
      rooms.forEach((room) => {
        io.in(room).emit("screen-share-started", socket.id);
      });
    } else {
      socket.emit("screen-share-denied");
    }
  });

  socket.on("stop-screen-share", () => {
    if (activeScreenSharerId === socket.id) {
      activeScreenSharerId = null;
      const rooms = [...socket.rooms];
      rooms.forEach((room) => {
        io.in(room).emit("screen-share-stopped");
      });
    }
  });

  socket.on("disconnect", () => {
    // find which room the user was in??
    // socket.io automatically leaves rooms on disconnect.
    // However, we might want to notify others in those rooms.
    // 'disconnecting' event gives access to socket.rooms BEFORE they are left.
    if (activeScreenSharerId === socket.id) {
      activeScreenSharerId = null;
      // Broadcast stop to everyone even if not cleaner way to find specific room here without iterating 
      // For simplicity in this app structure where we might be broadcasting globally or relying on disconnecting event
      // But since we are inside disconnect, rooms are gone.
      // We rely on 'disconnecting' for room broadcasts usually.
      // But we must clear the global variable.
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((room) => {
      socket.to(room).emit("user-left", socket.id)

      if (activeScreenSharerId === socket.id) {
        socket.to(room).emit("screen-share-stopped");
      }
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
