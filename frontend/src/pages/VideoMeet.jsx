import React, { useEffect, useRef, useState, useContext, useCallback } from "react";
import Avatar from '@mui/material/Avatar';
import { deepOrange } from '@mui/material/colors';
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import { Badge } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle"; // For kick
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import InfoIcon from "@mui/icons-material/Info";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { io } from "socket.io-client";
import { Snackbar, Alert, Chip } from "@mui/material";
import { AuthContext } from '../contexts/AuthContext';

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// global RTCPeerConnection map
let connections = {};

const stringToColor = (string) => {
  let hash = 0;
  let i;

  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.substr(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
};

// Memoized Video Component to prevent re-renders when typing
const VideoElement = React.memo(({ stream, videoEnabled, username, socketId, className, muted = false, isLocal = false }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      try {
        videoRef.current.srcObject = stream;
      } catch (error) {
        console.error('Error setting video stream:', error);
      }
    }
  }, [stream]);

  if (!videoEnabled && !isLocal) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
        <Avatar sx={{ bgcolor: stringToColor(username || "Remote"), width: 80, height: 80, fontSize: '2rem' }}>
          {username ? username.substring(0, 2).toUpperCase() : "U"}
        </Avatar>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      data-socket={socketId}
      autoPlay
      muted={muted}
      playsInline
      className={className}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return prevProps.stream === nextProps.stream &&
    prevProps.videoEnabled === nextProps.videoEnabled &&
    prevProps.username === nextProps.username &&
    prevProps.socketId === nextProps.socketId;
});

// Memoized Chat Message Component to prevent re-renders when typing
const ChatMessage = React.memo(({ msg, isMe, showSender }) => {
  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      {showSender && (
        <span className="text-[11px] text-zinc-400 mb-1 px-8 font-medium">{msg.sender}</span>
      )}
      <div className={`flex items-end gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMe && (
          <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', bgcolor: stringToColor(msg.sender), flexShrink: 0 }}>
            {msg.sender[0]?.toUpperCase()}
          </Avatar>
        )}
        <div className={`px-3 py-2 rounded-2xl text-sm break-words leading-relaxed ${isMe
            ? 'bg-blue-600 text-white rounded-tr-none'
            : 'bg-zinc-800 text-gray-200 rounded-tl-none'
          }`}>
          {msg.message}
        </div>
      </div>
      <span className={`text-[10px] text-zinc-600 mt-0.5 ${isMe ? 'pr-1' : 'pl-9'}`}>
        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
      </span>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.msg === nextProps.msg &&
    prevProps.isMe === nextProps.isMe &&
    prevProps.showSender === nextProps.showSender;
});

const VideoMeet = () => {
  const { userData } = useContext(AuthContext); // Access logged in user
  const [socket, setSocket] = useState(null);
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const localStreamRef = useRef(null);

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [videos, setVideos] = useState([]);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [newMessages, setNewMessages] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const showChatRef = useRef(false);
  const messagesEndRef = useRef(null);
  const [streamReady, setStreamReady] = useState(false);
  const [screenSharerId, setScreenSharerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: "", type: "info", action: null }); // Added type/action

  // Host / Admission State
  const [isHost, setIsHost] = useState(false);
  const [joinStatus, setJoinStatus] = useState("idle"); // idle, waiting, joined, rejected
  const [waitingUsers, setWaitingUsers] = useState([]);
  const [showInfo, setShowInfo] = useState(false);

  // connect socket
  useEffect(() => {
    const isProd = import.meta.env.VITE_SERVER === 'production';
    console.log("VideoMeet - isProd:", isProd);
    console.log("VideoMeet - VITE_SERVER:", import.meta.env.VITE_SERVER);
    console.log("VideoMeet - VITE_BACKEND_URI:", import.meta.env.VITE_BACKEND_URI);

    const socketUrl = isProd ? import.meta.env.VITE_BACKEND_URI : "http://localhost:8000/";
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    console.log("VideoMeet - Socket connecting to:", socketUrl);

    newSocket.on('connect', () => {
      console.log('✅ Socket connected:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const black = ({ width = 640, height = 480 } = {}) => {
    const canvas = Object.assign(document.createElement("canvas"), {
      width,
      height,
    });
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);
    const stream = canvas.captureStream();
    return Object.assign(stream.getVideoTracks()[0], { enabled: false });
  };

  const silence = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    return Object.assign(track, { enabled: false });
  };

  const getPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setVideoAvailable(stream.getVideoTracks().length > 0);
      setAudioAvailable(stream.getAudioTracks().length > 0);

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setStreamReady(true);
    } catch (err) {
      console.error("Permission error:", err);
      setVideoAvailable(false);
      setAudioAvailable(false);

      const fakeStream = new MediaStream([black(), silence()]);
      localStreamRef.current = fakeStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = fakeStream;
    }
  };

  const addConnection = (neighborId, incomingSignal, successCallback) => {
    const pc = new RTCPeerConnection(peerConfigConnections);
    connections[neighborId] = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", neighborId, JSON.stringify({ ice: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];

      let isVideoEnabled = false;
      if (remoteStream.getVideoTracks().length > 0) {
        isVideoEnabled = remoteStream.getVideoTracks()[0].enabled;
      }

      setVideos((prev) => {
        const exists = prev.find((v) => v.socketId === neighborId);
        return exists
          ? prev.map((v) =>
            v.socketId === neighborId ? { ...v, stream: remoteStream, videoEnabled: isVideoEnabled } : v
          )
          : [...prev, { socketId: neighborId, stream: remoteStream, videoEnabled: isVideoEnabled, username: "Guest" }];
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    if (incomingSignal) {
      pc.setRemoteDescription(new RTCSessionDescription(incomingSignal)).then(async () => {
        if (incomingSignal.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit(
            "signal",
            neighborId,
            JSON.stringify({ sdp: pc.localDescription })
          );
        }
      });
    }

    if (successCallback) successCallback(pc);
  };

  const gotMessageFromServer = async (fromId, message) => {
    if (fromId === socketIdRef.current) return;
    const signal = typeof message === "string" ? JSON.parse(message) : message;

    // IF WE DON'T HAVE A CONNECTION YET AND WE GET AN OFFER
    // WE NEED TO CREATE THE CONNECTION TO ANSWER IT
    if (!connections[fromId] && signal.sdp && signal.sdp.type === "offer") {
      addConnection(fromId, signal.sdp);
      return; // addConnection handles the rest
    }

    const pc = connections[fromId];
    if (!pc) return;

    if (signal.sdp) {
      // If we already have a connection, we might be getting an answer
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    }

    if (signal.ice) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.ice));
    }
  };

  useEffect(() => {
    if (!socket) return;

    getPermissions();

    socket.on("connect", () => {
      socketIdRef.current = socket.id;
      console.log("Connected:", socket.id);
    });

    socket.on("signal", gotMessageFromServer);

    // ✅ FIX: loop through all clients instead of only id
    socket.on("user-joined", async (id, clients, username) => {
      console.log("user-joined:", id, "clients:", clients, "username:", username);

      // If it's ME joining, 'clients' is the list of existing users
      if (id === socketIdRef.current) {
        clients.forEach((client) => {
          // client is { socketId, username }
          const clientId = client.socketId;
          const clientName = client.username;

          // Check self
          if (clientId === socketIdRef.current) return;
          // Check connection existence
          if (connections[clientId]) return;

          // Connect
          addConnection(clientId, null, async (pc) => {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("signal", clientId, JSON.stringify({ sdp: pc.localDescription }));
          });

          // Update videos state with username (even without stream yet so placeholder works)
          setVideos(prev => {
            const exists = prev.find(v => v.socketId === clientId);
            if (exists) return prev.map(v => v.socketId === clientId ? { ...v, username: clientName } : v);
            return [...prev, { socketId: clientId, stream: null, videoEnabled: false, username: clientName }];
          });
        });
      } else {
        // Someone else joined
        setNotification({ open: true, message: `${username || "User"} joined the meet`, type: "info" });

        // WAIT for them to offer. Do NOT initiate connection.
        // Just add a placeholder in UI so we see them in list
        setVideos(prev => {
          const exists = prev.find(v => v.socketId === id);
          if (exists) return prev.map(v => v.socketId === id ? { ...v, username: username } : v);
          return [...prev, { socketId: id, stream: null, videoEnabled: false, username: username }];
        });
      }
    });

    // NEW HANDLERS
    socket.on("room-joined", ({ isHost, username }) => {
      setJoinStatus("joined");
      setIsHost(isHost);
      setAskForUsername(false);
      setNotification({ open: true, message: `Joined as ${isHost ? 'Host' : 'Guest'}`, type: "success" });
    });

    socket.on("wait-for-host", () => {
      setJoinStatus("waiting");
      setAskForUsername(false);
    });

    socket.on("join-rejected", () => {
      setJoinStatus("rejected");
      alert("The host has rejected your request to join.");
      window.location.reload();
    });

    socket.on("kicked", () => {
      alert("You have been removed from the meeting.");
      window.location.reload();
    });

    socket.on("user-requested-join", (user) => {
      // user = { socketId, username }
      setWaitingUsers(prev => [...prev, user]);
      // Show notification with actions
      setNotification({
        open: true,
        message: `${user.username || "User"} wants to join`,
        type: "warning", // distinct color
        action: user // pass user obj to use in action button
      });
    });

    socket.on("user-left", (id) => {
      setVideos((prev) => prev.filter((v) => v.socketId !== id));
      if (connections[id]) {
        connections[id].close();
        delete connections[id];
      }
    });

    return () => {
      socket.off("connect");
      socket.off("signal");
      socket.off("user-joined");
      socket.off("user-left");

      Object.keys(connections).forEach((id) => {
        connections[id].close();
        delete connections[id];
      });
    };
  }, [socket]);

  useEffect(() => {
    if (socket && askForUsername && streamReady) {
      if (userData && (userData.username || userData.name)) {
        setUsername(userData.username || userData.name);
        // We could auto-request to join if we trust the user is authenticated?
        // defaults to manual join click for now to let them check audio/video.
      } else {
        const savedUsername = window.localStorage.getItem("video_call_username");
        if (savedUsername) {
          setUsername(savedUsername);
        }
      }
    }
  }, [socket, askForUsername, streamReady, userData]);

  // Handle Video Toggle Listener in a separate effect or inside the existing one,
  // but we need 'setVideos' dependency.
  useEffect(() => {
    if (!socket) return;

    socket.on("video-toggle", (socketId, isAvailable) => {
      try {
        setVideos((prev) => {
          return prev.map((v) => {
            if (v.socketId === socketId) {
              return { ...v, videoEnabled: isAvailable };
            }
            return v;
          })
        })
      } catch (error) {
        console.error("Error handling video toggle:", error);
      }
    });



    socket.on("screen-share-started", (sharerId) => {
      setScreenSharerId(sharerId);
    });

    socket.on("screen-share-stopped", () => {
      setScreenSharerId(null);
    });

    socket.on("screen-share-denied", () => {
      alert("Someone else is already sharing their screen.");
      setIsScreenSharing(false);
    });

    socket.on("chat-message", (data) => {
      // data: { sender, message, timestamp }
      try {
        setMessages((prev) => [...prev, data]);
        if (!showChatRef.current) {
          setNewMessages((prev) => prev + 1);
        }
      } catch (error) {
        console.error("Error handling chat message:", error);
        setNotification({ open: true, message: "Error receiving message", type: "error" });
      }
    });

    return () => {
      socket.off("video-toggle");
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("room-joined");
      socket.off("wait-for-host");
      socket.off("join-rejected");
      socket.off("kicked");
      socket.off("user-requested-join");
      socket.off("chat-message");
    };
  }, [socket]);

  const connect = () => {
    // setAskForUsername(false); // don't hide yet, wait for response
    window.localStorage.setItem("video_call_username", username);
    socket.emit("join-request", window.location.href, username);
  };

  const admitUser = (user) => {
    socket.emit("admit-user", { socketId: user.socketId, path: window.location.href });
    setWaitingUsers(prev => prev.filter(u => u.socketId !== user.socketId));
    setNotification({ ...notification, open: false });
  };

  const rejectUser = (user) => {
    socket.emit("reject-user", { socketId: user.socketId, path: window.location.href });
    setWaitingUsers(prev => prev.filter(u => u.socketId !== user.socketId));
    setNotification({ ...notification, open: false });
  };

  const kickUser = (socketId) => {
    if (!window.confirm("Are you sure you want to kick this user?")) return;
    socket.emit("kick-user", socketId);
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleEndCall = () => {
    window.localStorage.removeItem("video_call_username");
    window.location.reload();
  };

  const toggleVideo = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const currentVideoTrack = stream.getVideoTracks()[0];
    if (!currentVideoTrack) return;

    if (videoAvailable) {
      // Turn OFF: Stop the camera and replace with black track
      stream.getVideoTracks().forEach(track => track.stop());

      const blackTrack = black();
      stream.removeTrack(currentVideoTrack);
      stream.addTrack(blackTrack);

      // Update all peer connections
      Object.values(connections).forEach((pc) => {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === "video");
        if (videoSender) {
          videoSender.replaceTrack(blackTrack);
        }
      });

      setVideoAvailable(false);
      if (!askForUsername) {
        socket.emit("video-toggle", false);
      }
    } else {
      // Turn ON: Get real camera and replace black track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];

        stream.removeTrack(currentVideoTrack);
        currentVideoTrack.stop();
        stream.addTrack(newVideoTrack);

        // Update all peer connections
        Object.values(connections).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack);
          }
        });

        setVideoAvailable(true);
        if (!askForUsername) {
          socket.emit("video-toggle", true);
        }
      } catch (err) {
        console.error("Failed to turn on camera:", err);
        setNotification({ open: true, message: "Failed to access camera", type: "error" });
      }
    }
  };

  const toggleAudio = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const currentAudioTrack = stream.getAudioTracks()[0];
    if (!currentAudioTrack) return;

    if (audioAvailable) {
      // Turn OFF: Stop the microphone and replace with silent track
      stream.getAudioTracks().forEach(track => track.stop());

      const silentTrack = silence();
      stream.removeTrack(currentAudioTrack);
      stream.addTrack(silentTrack);

      // Update all peer connections
      Object.values(connections).forEach((pc) => {
        const senders = pc.getSenders();
        const audioSender = senders.find(s => s.track && s.track.kind === "audio");
        if (audioSender) {
          audioSender.replaceTrack(silentTrack);
        }
      });

      setAudioAvailable(false);
    } else {
      // Turn ON: Get real microphone and replace silent track
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newAudioTrack = newStream.getAudioTracks()[0];

        stream.removeTrack(currentAudioTrack);
        currentAudioTrack.stop();
        stream.addTrack(newAudioTrack);

        // Update all peer connections
        Object.values(connections).forEach((pc) => {
          const senders = pc.getSenders();
          const audioSender = senders.find(s => s.track && s.track.kind === "audio");
          if (audioSender) {
            audioSender.replaceTrack(newAudioTrack);
          }
        });

        setAudioAvailable(true);
      } catch (err) {
        console.error("Failed to turn on microphone:", err);
        setNotification({ open: true, message: "Failed to access microphone", type: "error" });
      }
    }
  };

  const startScreenShare = async () => {
    // Check if screen share is supported (not on most mobile browsers)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setNotification({ open: true, message: "Screen sharing is not supported on this device/browser.", type: "warning" });
      return;
    }

    try {
      // Check if someone else is sharing based on local state first to save a trip
      if (screenSharerId && screenSharerId !== socketIdRef.current) {
        alert("Someone is already sharing.");
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      screenTrack.onended = () => {
        stopScreenShare();
      };

      // Now tell server we want to share
      socket.emit("request-screen-share");

      setIsScreenSharing(true);

      // Replace track in all connections
      Object.values(connections).forEach((pc) => {
        const senders = pc.getSenders();
        const sender = senders.find(s => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
      localStreamRef.current = screenStream;
      setVideoAvailable(true);
      if (localVideoRef.current) {
        localVideoRef.current.classList.remove("scale-x-[-1]");
      }

    } catch (err) {
      console.error("Failed to share screen", err);
    }
  };

  const stopScreenShare = async () => {
    try {
      const screenStream = localStreamRef.current;
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }

      // Revert to camera
      await getPermissions(); // This resets localStreamRef to camera

      // Mirror local video again if needed (default camera usually mirrored)
      if (localVideoRef.current) {
        localVideoRef.current.classList.add("scale-x-[-1]");
      }

      // Replace tracks in connections
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      Object.values(connections).forEach((pc) => {
        const senders = pc.getSenders();
        const sender = senders.find(s => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(cameraTrack);
        }
      });

      socket.emit("stop-screen-share");
      setIsScreenSharing(false);
      setScreenSharerId(null);
    } catch (err) {
      console.error("Error stopping screen share", err);
    }
  };

  const sendMessage = useCallback(() => {
    if (message.trim() && socket) {
      try {
        socket.emit("chat-message", message.trim());
        setMessage("");
      } catch (error) {
        console.error("Error sending message:", error);
        setNotification({ open: true, message: "Failed to send message", type: "error" });
      }
    }
  }, [message, socket]);

  // Keep showChatRef in sync with showChat state
  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  // Auto-scroll messages to bottom when new message arrives
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Memoize message input handler to prevent re-renders
  const handleMessageChange = useCallback((e) => {
    try {
      setMessage(e.target.value.slice(0, 500));
    } catch (error) {
      console.error("Error updating message:", error);
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    try {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    } catch (error) {
      console.error("Error handling key down:", error);
    }
  }, [sendMessage]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setNotification({ open: true, message: "Link copied to clipboard", type: "success" });
    showInfo && setShowInfo(false);
  };
  //   const getVideoButtonStyles = (isVideoOn) => ({
  //   backgroundColor: isVideoOn ? "#000000" : "#E5CDCB",
  //   color: isVideoOn ? "#ffffff" : "#6B3E2E",
  //   "&:hover": {
  //     backgroundColor: isVideoOn ? "rgba(0,0,0,0.85)" : "#E5CDCB",
  //   },
  //   width: 48,
  //   height: 48,
  // });


  return (
    <div>
      {/* WAITING SCREEN */}
      {joinStatus === "waiting" && (
        <div className="h-screen flex justify-center items-center bg-black text-white flex-col gap-5">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mb-4"></div>
          <h2 className="text-2xl font-semibold">Waiting for the host to let you in...</h2>
          <p className="text-zinc-400">Sit tight, you'll be admitted soon.</p>
        </div>
      )}

      {/* AUTH SCREEN */}
      {askForUsername && joinStatus === "idle" ? (
        <div className="h-screen flex justify-center items-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-white">
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-10 shadow-2xl border border-white/10 flex flex-col items-center gap-6 max-w-[500px] w-[90%]">
            <h2 className="m-0 font-semibold text-3xl">Ready to join?</h2>

            <div className="relative w-full rounded-2xl overflow-hidden aspect-video bg-black">
              {videoAvailable ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Avatar sx={{ width: 80, height: 80, bgcolor: deepOrange[500] }}>
                    {username ? username[0]?.toUpperCase() : "U"}
                  </Avatar>
                </div>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/60 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-white/10 shadow-lg hover:border-white/20 transition-all">
                <IconButton
                  onClick={toggleAudio}
                  className={`!transition-all !duration-200 !border ${audioAvailable
                    ? '!bg-white/10 hover:!bg-white/20 !border-white/5 !text-white'
                    : '!bg-red-500 hover:!bg-red-600 !border-red-500 !text-white !shadow-lg !shadow-red-500/20'}`}
                  size="medium"
                >
                  {audioAvailable ? <MicIcon fontSize="inherit" /> : <MicOffIcon fontSize="inherit" />}
                </IconButton>
                <IconButton
                  onClick={toggleVideo}
                  className={`!transition-all !duration-200 !border ${videoAvailable
                    ? '!bg-white/10 hover:!bg-white/20 !border-white/5 !text-white'
                    : '!bg-red-500 hover:!bg-red-600 !border-red-500 !text-white !shadow-lg !shadow-red-500/20'}`}
                  size="medium"
                >
                  {videoAvailable ? <VideocamIcon fontSize="inherit" /> : <VideocamOffIcon fontSize="inherit" />}
                </IconButton>
              </div>
            </div>

            <TextField
              fullWidth
              variant="outlined"
              label="Display Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "white",
                  "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                  "&:hover fieldset": { borderColor: "white" },
                  "&.Mui-focused fieldset": { borderColor: "#90caf9" },
                },
                "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.7)" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#90caf9" }
              }}
            />

            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={connect}
              disabled={!username.trim()}
              sx={{
                borderRadius: "12px",
                color: 'black',
                fontWeight: "bold",
                padding: "12px",
                fontSize: "1.1rem",
                textTransform: "none",
                background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
                boxShadow: "0 3px 5px 2px rgba(33, 203, 243, .3)",
              }}
            >
              <span className="text-black">Join Meeting</span>
            </Button>
          </div>
        </div>
      ) : joinStatus === "joined" ? (
        <div className="relative h-screen w-screen bg-zinc-950 overflow-hidden flex justify-center items-center">

          {/* Waiting List OVERLAY (Host Only) */}
          {isHost && waitingUsers.length > 0 && (
            <div className="absolute top-5 left-5 z-50 w-[280px] 
                  bg-white/90 backdrop-blur-lg 
                  border border-gray-200 
                  p-4 rounded-2xl shadow-xl 
                  flex flex-col gap-3">

              <h3 className="text-gray-800 font-semibold text-sm tracking-wide">
                Waiting Room
                <span className="ml-2 text-xs font-medium text-gray-500">
                  ({waitingUsers.length})
                </span>
              </h3>

              <div className="flex flex-col gap-2">
                {waitingUsers.map(u => (
                  <div
                    key={u.socketId}
                    className="flex justify-between items-center 
                     bg-gray-100 hover:bg-gray-200 
                     transition-colors duration-150
                     px-3 py-2 rounded-lg text-sm text-gray-800"
                  >
                    <span className="font-medium truncate">{u.username}</span>

                    <div className="flex gap-2">
                      <IconButton
                        size="small"
                        onClick={() => admitUser(u)}
                        className="!bg-green-500 !text-white 
                         hover:!bg-green-600 
                         shadow-sm rounded-full"
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => rejectUser(u)}
                        className="!bg-red-500 !text-white 
                         hover:!bg-red-600 
                         shadow-sm rounded-full"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Controls Bar */}
          {/* Outer wrapper: always-visible End Call + scrollable inner buttons */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-zinc-950/80 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-50 transition-all hover:border-white/20 hover:shadow-sky-500/10 max-w-[calc(100vw-2rem)]">

            {/* Scrollable secondary controls */}
            <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 overflow-x-auto scrollbar-hide">

              {/* Info */}
              <IconButton
                onClick={() => setShowInfo(true)}
                className="group !bg-zinc-800/50 hover:!bg-zinc-700 !border !border-white/5 !text-gray-400 hover:!text-white !transition-all !duration-200"
                size="large"
              >
                <InfoIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
              </IconButton>

              <div className="h-8 w-px bg-white/10 flex-shrink-0" />

              {/* Video Toggle */}
              <IconButton
                onClick={toggleVideo}
                className={`group !transition-all !duration-200 !border ${videoAvailable
                  ? '!bg-zinc-800/50 hover:!bg-zinc-700 !border-white/5 !text-white'
                  : '!bg-red-500/90 hover:!bg-red-600 !border-red-500 !text-white !shadow-lg !shadow-red-500/20'}`}
                size="large"
              >
                {videoAvailable
                  ? <VideocamIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                  : <VideocamOffIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                }
              </IconButton>

              {/* Audio Toggle */}
              <IconButton
                onClick={toggleAudio}
                className={`group !transition-all !duration-200 !border ${audioAvailable
                  ? '!bg-zinc-800/50 hover:!bg-zinc-700 !border-white/5 !text-white'
                  : '!bg-red-500/90 hover:!bg-red-600 !border-red-500 !text-white !shadow-lg !shadow-red-500/20'}`}
                size="large"
              >
                {audioAvailable
                  ? <MicIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                  : <MicOffIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                }
              </IconButton>

              {/* Screen Share */}
              {!isScreenSharing ? (
                <IconButton
                  onClick={startScreenShare}
                  disabled={screenSharerId !== null}
                  className={`group !transition-all !duration-200 !border ${screenSharerId !== null
                    ? "!opacity-30 !cursor-not-allowed"
                    : "!bg-zinc-800/50 hover:!bg-zinc-700 !border-white/5 !text-sky-400 hover:!text-sky-300"}`}
                  size="large"
                >
                  <ScreenShareIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                </IconButton>
              ) : (
                <IconButton
                  onClick={stopScreenShare}
                  className="group !bg-orange-500/90 hover:!bg-orange-600 !text-white !shadow-lg !shadow-orange-500/20 !border !border-orange-500 !transition-all !duration-200"
                  size="large"
                >
                  <StopScreenShareIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                </IconButton>
              )}

              {/* Chat */}
              <Badge badgeContent={newMessages} color="error" overlap="circular" max={99}>
                <IconButton
                  onClick={() => {
                    const next = !showChat;
                    setShowChat(next);
                    if (next) setNewMessages(0);
                  }}
                  className={`group !transition-all !duration-200 !border ${showChat
                    ? '!bg-blue-600 hover:!bg-blue-700 !border-blue-500 !text-white !shadow-lg !shadow-blue-600/20'
                    : '!bg-zinc-800/50 hover:!bg-zinc-700 !border-white/5 !text-white'}`}
                  size="large"
                >
                  <ChatIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
                </IconButton>
              </Badge>
            </div>

            {/* Permanent End Call — always visible, outside scroll area */}
            <div className="flex items-center pr-3 pl-1 py-3 flex-shrink-0 border-l border-white/10">
              <IconButton
                onClick={handleEndCall}
                className="group !bg-red-600 hover:!bg-red-700 !text-white !shadow-lg !shadow-red-600/30 !border !border-red-500 !transition-all !duration-200 hover:!scale-105"
                size="large"
              >
                <CallEndIcon fontSize="inherit" className="group-hover:scale-110 transition-transform" />
              </IconButton>
            </div>
          </div>

          {/* Meeting Info Popup */}
          {showInfo && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-zinc-900/90 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 min-w-[350px]">
              <div className="flex justify-between items-center text-white">
                <h3 className="text-xl font-semibold">Meeting Info</h3>
                <IconButton onClick={() => setShowInfo(false)} size="small" className="!text-white hover:!bg-red-600">
                  <CloseIcon />
                </IconButton>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-300">Share this link with others joining:</p>
                <div className="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-white/10">
                  <input
                    type="text"
                    readOnly
                    value={window.location.href}
                    className="bg-transparent text-white text-sm w-full outline-none px-2"
                  />
                  <IconButton onClick={copyToClipboard} size="small" className="!text-white hover:!bg-blue-300">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </div>
              </div>
            </div>
          )}

          {/* CHAT CONTAINER */}
          {showChat && (
            <div className="absolute top-[80px] right-5 bottom-[100px] w-full max-w-sm z-[60] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-zinc-900">
                <h3 className="text-white font-semibold">In-Call Messages</h3>
                <IconButton onClick={() => setShowChat(false)} size="small" className="text-white/50 hover:text-white">
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>

              {/* Messages List */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
                    <ChatIcon sx={{ fontSize: 40, opacity: 0.2 }} />
                    <p className="text-sm">No messages yet. Say hello! 👋</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.sender === username;
                    const showSender = !isMe && (i === 0 || messages[i - 1]?.sender !== msg.sender);
                    return (
                      <ChatMessage
                        key={`${msg.timestamp}-${i}`}
                        msg={msg}
                        isMe={isMe}
                        showSender={showSender}
                      />
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 bg-zinc-900 border-t border-white/10">
                <div className="flex gap-2 items-center bg-zinc-800/50 p-2 rounded-xl border border-white/5 focus-within:border-blue-500/50 transition-colors">
                  <input
                    type="text"
                    value={message}
                    onChange={handleMessageChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message... (Enter to send)"
                    className="bg-transparent border-none outline-none text-white text-sm flex-1 ml-2 placeholder-zinc-500"
                    maxLength={500}
                  />
                  <IconButton
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    size="small"
                    className={`!transition-all !duration-200 ${message.trim() ? '!text-blue-400 hover:!bg-blue-500/15 hover:!scale-110' : '!text-zinc-600'}`}
                  >
                    <SendIcon fontSize="small" />
                  </IconButton>
                </div>
                {message.length > 400 && (
                  <p className="text-[10px] text-zinc-500 mt-1 text-right">{message.length}/500</p>
                )}
              </div>
            </div>
          )}

          {/* Local Video - Floating: top-right on mobile, bottom-right on desktop */}
          <div className={`absolute top-4 right-4 md:top-auto md:bottom-5 md:right-5 w-[110px] h-[72px] md:w-[250px] md:h-[150px] rounded-xl border-2 border-white/20 shadow-2xl overflow-hidden z-30 transition-all duration-300 bg-black hover:scale-105`}>
            {videoAvailable ? (
              <VideoElement
                stream={localStreamRef.current}
                videoEnabled={videoAvailable}
                username={username}
                socketId="local"
                muted={true}
                isLocal={true}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black">
                <Avatar sx={{ bgcolor: stringToColor(username || "Local") }}>
                  {username ? username.substring(0, 2).toUpperCase() : "U"}
                </Avatar>
              </div>
            )}
          </div>

          <div className="flex w-full h-full">
            {screenSharerId ? (
              // HERO LAYOUT - responsive for mobile
              <div className="w-full h-full flex flex-col md:flex-row p-3 md:p-5 gap-3 md:gap-5">

                {/* Main Hero Area (Shared Screen) */}
                <div className="flex-1 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative min-h-0">
                  {(() => {
                    if (screenSharerId === socketIdRef.current) {
                      return (
                        <video
                          ref={(v) => {
                            if (v && localStreamRef.current) v.srcObject = localStreamRef.current;
                          }}
                          autoPlay muted playsInline
                          className="w-full h-full object-contain bg-black"
                        />
                      )
                    }
                    const remoteVideo = videos.find(v => v.socketId === screenSharerId);
                    if (remoteVideo) {
                      return (
                        <video
                          ref={(v) => {
                            if (v && remoteVideo.stream) v.srcObject = remoteVideo.stream;
                          }}
                          autoPlay playsInline
                          className="w-full h-full object-contain bg-black"
                        />
                      )
                    }
                    return <div className="text-white text-center mt-20">Loading Screen Share...</div>
                  })()}
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg animate-pulse">
                    Live Screen Share
                  </div>
                </div>

                {/* Sidebar for other participants - hidden on mobile */}
                <div className="hidden md:flex w-[300px] flex-col gap-4 overflow-y-auto">
                  {screenSharerId !== socketIdRef.current && (
                    <div className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 shadow-md">
                      <video
                        ref={(v) => { if (v && localStreamRef.current) v.srcObject = localStreamRef.current; }}
                        autoPlay muted playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">You</div>
                    </div>
                  )}

                  {videos.filter(v => v.socketId !== screenSharerId).map((video) => (
                    <div key={video.socketId} className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 shadow-md">
                      {!video.videoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                          <Avatar sx={{ width: 40, height: 40, fontSize: '1rem', bgcolor: stringToColor(video.username || "Guest") }}>
                            {video.username ? video.username.substring(0, 2).toUpperCase() : "U"}
                          </Avatar>
                        </div>
                      )}
                      <video
                        ref={(v) => { if (v && video.stream) v.srcObject = video.stream; }}
                        autoPlay playsInline
                        className={`w-full h-full object-cover ${video.videoEnabled ? 'block' : 'hidden'}`}
                      />
                      <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">{video.username || video.socketId}</div>
                      {isHost && (
                        <div className="absolute top-2 right-2">
                          <IconButton size="small" onClick={() => kickUser(video.socketId)} className="bg-red-500 hover:bg-red-600 text-white shadow-lg">
                            <RemoveCircleIcon fontSize="small" />
                          </IconButton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              // GRID LAYOUT (Existing)
              <div className={`flex flex-wrap justify-center items-center w-full h-full p-5 gap-5 ${videos.length === 0 ? 'flex-col' : ''}`}>
                {videos.length === 0 ? (
                  <div className="flex-1 w-full max-w-4xl max-h-[80vh] aspect-video relative rounded-2xl overflow-hidden bg-zinc-900 shadow-xl border border-zinc-800 flex justify-center items-center">
                    <div className="flex justify-center items-center w-full h-full bg-zinc-800 text-white">
                      <h2 className="text-xl opacity-70">Waiting for others to join...</h2>
                    </div>
                  </div>
                ) : (
                  videos.map((video) => (
                    <div key={video.socketId} className={`relative rounded-2xl overflow-hidden bg-zinc-900 shadow-md flex justify-center items-center transition-all ${videos.length === 1 ? 'w-full h-full max-w-6xl' :
                      videos.length === 2 ? 'w-[48%] h-full' :
                        videos.length === 3 ? 'w-[48%] h-[46%]' :
                          'flex-1 min-w-[45%] max-w-full max-h-[48%] aspect-video'
                      }`}>
                      {!video.videoEnabled && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
                          <Avatar sx={{ bgcolor: stringToColor(video.username || "Remote"), width: 80, height: 80, fontSize: '2rem' }}>
                            {video.username ? video.username.substring(0, 2).toUpperCase() : "U"}
                          </Avatar>
                        </div>
                      )}
                      <VideoElement
                        stream={video.stream}
                        videoEnabled={video.videoEnabled}
                        username={video.username}
                        socketId={video.socketId}
                        className={`w-full h-full object-cover ${video.videoEnabled ? 'block' : 'hidden'}`}
                      />

                      <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded text-sm text-white pointer-events-none">
                        {video.username || video.socketId}
                      </div>

                      {isHost && (
                        <div className="absolute top-4 right-4 z-50">
                          <IconButton size="small" onClick={() => kickUser(video.socketId)} className="bg-red-500 hover:bg-red-600 text-white shadow-lg">
                            <RemoveCircleIcon fontSize="small" />
                          </IconButton>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <Snackbar
        open={notification.open}
        autoHideDuration={notification.action ? 6000 : 4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.type || "info"}
          sx={{ width: '100%', alignItems: 'center' }}
          action={notification.action && (
            <div className="flex gap-2">
              <Button color="inherit" size="small" onClick={() => admitUser(notification.action)}>
                Admit
              </Button>
              <Button color="inherit" size="small" onClick={() => rejectUser(notification.action)}>
                Reject
              </Button>
            </div>
          )}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default VideoMeet;
