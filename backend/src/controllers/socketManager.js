import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};
let usernames = {}; // Store usernames for each socket
let roomUsers = {}; // Store user details per room

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
        roomUsers[path] = [];
      }
      
      connections[path].push(socket.id);
      usernames[socket.id] = username || "Guest";
      timeOnline[socket.id] = new Date();
      
      // Add user to room users list
      roomUsers[path].push({
        socketId: socket.id,
        username: username || "Guest"
      });

      console.log(`${socket.id} (${username}) joined ${path}`);

      // Get current room users list
      const currentRoomUsers = roomUsers[path];

      // Broadcast to all clients in the room
      for (let a = 0; a < connections[path].length; a++) {
        io.to(connections[path][a]).emit(
          "user-joined",
          socket.id,
          currentRoomUsers,
          username || "Guest"
        );
      }
    });

    // handle WebRTC signaling
    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    // handle chat messages
    socket.on("chat-message", (data) => {
      const sender = usernames[socket.id] || "Guest";
      
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
        
        const messageObj = {
          sender: sender,
          message: data,
          timestamp: new Date().toISOString()
        };
        
        messages[matchingRoom].push(messageObj);
        console.log("message", matchingRoom, ":", sender, data);

        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("chat-message", messageObj);
        });
      }
    });

    // handle join request (admission control)
    socket.on("join-request", (path, username) => {
      usernames[socket.id] = username || "Guest";
      
      if (!connections[path] || connections[path].length === 0) {
        // First person is the host - add them to the room immediately
        if (!connections[path]) {
          connections[path] = [];
          roomUsers[path] = [];
        }
        
        connections[path].push(socket.id);
        timeOnline[socket.id] = new Date();
        
        roomUsers[path].push({
          socketId: socket.id,
          username: username || "Guest"
        });

        socket.emit("room-joined", { isHost: true, username });
        
        // Emit user-joined to the host themselves
        socket.emit("user-joined", socket.id, roomUsers[path], username);
        
        console.log(`${socket.id} (${username}) joined as host in ${path}`);
      } else {
        // Guest - need host approval
        const hostId = connections[path][0];
        io.to(hostId).emit("user-requested-join", { socketId: socket.id, username });
        socket.emit("wait-for-host");
      }
    });

    // host admits a user
    socket.on("admit-user", ({ socketId, path }) => {
      const username = usernames[socketId] || "Guest";
      
      // Add the user to the room
      if (!connections[path]) {
        connections[path] = [];
        roomUsers[path] = [];
      }
      
      connections[path].push(socketId);
      timeOnline[socketId] = new Date();
      
      roomUsers[path].push({
        socketId: socketId,
        username: username
      });

      // Get current room users list
      const currentRoomUsers = roomUsers[path];

      // Notify the admitted user they've been admitted
      io.to(socketId).emit("room-joined", { isHost: false, username });

      // Broadcast to all clients in the room about the new user
      for (let a = 0; a < connections[path].length; a++) {
        io.to(connections[path][a]).emit(
          "user-joined",
          socketId,
          currentRoomUsers,
          username
        );
      }

      console.log(`${socketId} (${username}) was admitted to ${path}`);
    });

    // host rejects a user
    socket.on("reject-user", ({ socketId }) => {
      io.to(socketId).emit("join-rejected");
    });

    // host kicks a user
    socket.on("kick-user", (socketId) => {
      io.to(socketId).emit("kicked");
    });

    // video toggle
    socket.on("video-toggle", (isAvailable) => {
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
        connections[matchingRoom].forEach((elem) => {
          if (elem !== socket.id) {
            io.to(elem).emit("video-toggle", socket.id, isAvailable);
          }
        });
      }
    });

    // screen share handlers
    socket.on("request-screen-share", () => {
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
        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("screen-share-started", socket.id);
        });
      }
    });

    socket.on("stop-screen-share", () => {
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
        connections[matchingRoom].forEach((elem) => {
          io.to(elem).emit("screen-share-stopped");
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
            delete roomUsers[k];
          } else {
            // Remove user from roomUsers as well
            roomUsers[k] = roomUsers[k].filter((user) => user.socketId !== socket.id);
          }
        }
      }

      console.log("user disconnected:", socket.id, "after", diffTime, "ms");
      delete timeOnline[socket.id];
      delete usernames[socket.id];
    });
  });

  return io;
};

export default connectToSocket;
