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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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
