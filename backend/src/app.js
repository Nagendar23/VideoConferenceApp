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

// global state
let activeScreenSharerId = null;
const userMap = {};
const roomHosts = {}; // path -> socketId
const waitingUsers = {}; // path -> [{ socketId, username }]

// handle socket.io events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('message', (data) => {
    console.log('Message from client:', data);
    socket.emit('reply', `Server got your message: ${data}`);
  });

  socket.on("join-request", (path, username) => {
    userMap[socket.id] = username || "Guest";

    // Check if room has a host
    if (!roomHosts[path]) {
      // No host -> New Room -> This user is Host
      roomHosts[path] = socket.id;

      socket.join(path);
      // Emit room-joined to self (as Host)
      socket.emit("room-joined", { isHost: true, username: userMap[socket.id] });

      // Also emit user-joined (to self mainly to init list, though empty)
      io.to(socket.id).emit("user-joined", socket.id, [], userMap[socket.id]);

    } else {
      // Room exists -> Join Waiting Room
      if (!waitingUsers[path]) waitingUsers[path] = [];
      waitingUsers[path].push({ socketId: socket.id, username: userMap[socket.id] });

      // Notify Host
      const hostSocketId = roomHosts[path];
      io.to(hostSocketId).emit("user-requested-join", { socketId: socket.id, username: userMap[socket.id] });

      // Tell user to wait
      socket.emit("wait-for-host");
    }
  });

  socket.on("admit-user", ({ socketId, path }) => {
    // Only host can admit
    if (roomHosts[path] !== socket.id) return;

    // Find user in waiting list
    if (waitingUsers[path]) {
      waitingUsers[path] = waitingUsers[path].filter(u => u.socketId !== socketId);
    }

    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
      targetSocket.join(path);

      // Emit room-joined to accepted user
      targetSocket.emit("room-joined", { isHost: false, username: userMap[socketId] });

      // Standard join flow logic
      let clients = [...io.sockets.adapter.rooms.get(path)];
      const existingUsers = clients.map(clientId => ({
        socketId: clientId,
        username: userMap[clientId] || "Guest"
      }));

      // Notify accepted user about existing users
      io.to(socketId).emit("user-joined", socketId, existingUsers, userMap[socketId]);

      // Notify others (AND the host) about new user
      io.to(path).emit("user-joined", socketId, [], userMap[socketId]);

      // If screen share active, tell new user
      if (activeScreenSharerId) {
        io.to(socketId).emit("screen-share-started", activeScreenSharerId);
      }
    }
  });

  socket.on("reject-user", ({ socketId, path }) => {
    if (roomHosts[path] !== socket.id) return;

    if (waitingUsers[path]) {
      waitingUsers[path] = waitingUsers[path].filter(u => u.socketId !== socketId);
    }

    io.to(socketId).emit("join-rejected");
  });

  socket.on("kick-user", (targetSocketId) => {
    // We assume socket is host. Ideally pass path to verify.
    // Getting path from rooms:
    const rooms = [...socket.rooms];
    // Find the room where this user is host
    const managedRoom = rooms.find(r => roomHosts[r] === socket.id);

    if (managedRoom) {
      io.to(targetSocketId).emit("kicked");
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.leave(managedRoom);
      }
      io.to(managedRoom).emit("user-left", targetSocketId);
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
    if (activeScreenSharerId === socket.id) {
      activeScreenSharerId = null;
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((room) => {
      socket.to(room).emit("user-left", socket.id);

      if (activeScreenSharerId === socket.id) {
        socket.to(room).emit("screen-share-stopped");
      }

      // Host Migration / Cleanup
      if (roomHosts[room] === socket.id) {
        // Host left
        // Reassign to next client?
        const clients = io.sockets.adapter.rooms.get(room);
        if (clients && clients.size > 1) { // > 1 because current socket still in list?
          // Actually disconnecting happens before leave in some versions, but clients iterator includes self?
          // 'clients' is a Set.
          // We need to pick someone else.
          let newHostId = null;
          for (const clientId of clients) {
            if (clientId !== socket.id) {
              newHostId = clientId;
              break;
            }
          }

          if (newHostId) {
            roomHosts[room] = newHostId;
            // Notify new host? (Optional feature)
            // For now just keep room open.
          } else {
            delete roomHosts[room];
          }
        } else {
          delete roomHosts[room];
          delete waitingUsers[room];
        }
      }

      // Remove from waiting list if they were waiting
      if (waitingUsers[room]) {
        waitingUsers[room] = waitingUsers[room].filter(u => u.socketId !== socket.id);
      }
    });
    // Remove user from map
    delete userMap[socket.id];
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
