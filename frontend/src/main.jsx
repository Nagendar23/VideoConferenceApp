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
const socket = io("http://localhost:8000/");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App socket={socket} />
  </React.StrictMode>
);
