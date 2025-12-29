// frontend/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { io } from "socket.io-client";
import { Buffer } from "buffer";

// Polyfill Buffer for engine.io
window.Buffer = Buffer;

// Connect to backend Socket.IO server
const isProd = import.meta.env.VITE_SERVER === "production";
console.log("Main.jsx - isProd:", isProd);
console.log("Main.jsx - VITE_SERVER:", import.meta.env.VITE_SERVER);
console.log("Main.jsx - VITE_BACKEND_URI:", import.meta.env.VITE_BACKEND_URI);

const socketUrl = isProd ? import.meta.env.VITE_BACKEND_URI : "http://localhost:8000/";
const socket = io(socketUrl, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

console.log("Main.jsx - Socket connecting to:", socketUrl);

socket.on('connect', () => {
  console.log('✅ Main socket connected:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Main socket connection error:', error);
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App socket={socket} />
  </React.StrictMode>
);
