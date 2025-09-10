import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["*"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("a user connected:", socket.id);

    // when user joins a call/room
    socket.on("join-call", (path, username) => {
      if (!connections[path]) {
        connections[path] = [];
      }
      connections[path].push(socket.id);
      timeOnline[socket.id] = new Date();

      console.log(`${socket.id} joined ${path}`);

      // ✅ broadcast both the new id and the full clients list
      for (let a = 0; a < connections[path].length; a++) {
        io.to(connections[path][a]).emit(
          "user-joined",
          socket.id,
          connections[path]
        );
      }
    });

    // handle WebRTC signaling
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // handle chat messages
    socket.on("chat-message", (data, sender) => {
      const [matchingRoom, found] = Object.entries(connections).reduce(
        ([room, isFound], [roomKey, roomValue]) => {
          if (!isFound && roomValue.includes(socket.id)) {
            return [roomKey, true];
          }
          return [room, isFound];
        },
        ["", false]
      );

      if (found) {
        if (!messages[matchingRoom]) {
          messages[matchingRoom] = [];
        }
        messages[matchingRoom].push({
          sender,
          data,
          "socket-id-sender": socket.id,
        });
        console.log("message", matchingRoom, ":", sender, data);

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", data, sender, socket.id);
        });
      }
    });

    // handle disconnects
    socket.on("disconnect", () => {
      const diffTime = Math.abs(timeOnline[socket.id] - new Date());
      let roomKey = null;

      for (const [k, v] of Object.entries(connections)) {
        if (v.includes(socket.id)) {
          roomKey = k;
          // notify others in the room
          v.forEach((id) => {
            io.to(id).emit("user-left", socket.id);
          });

          // remove from room
          connections[k] = v.filter((id) => id !== socket.id);
          if (connections[k].length === 0) {
            delete connections[k];
          }
        }
      }

      console.log("user disconnected:", socket.id, "after", diffTime, "ms");
      delete timeOnline[socket.id];
    });
  });

  return io;
};

export default connectToSocket;
