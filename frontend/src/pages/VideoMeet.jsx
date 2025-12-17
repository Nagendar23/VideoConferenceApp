import React, { useEffect, useRef, useState } from "react";
import Avatar from '@mui/material/Avatar';
import { deepOrange, deepPurple } from '@mui/material/colors';
import "../styles/videoComponent.css";
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
import { io } from "socket.io-client";

const peerConfigConnections = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// global RTCPeerConnection map
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

const VideoMeet = () => {
  const [socket, setSocket] = useState(null);
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const localStreamRef = useRef(null);

  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [videos, setVideos] = useState([]);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [newMessages] = useState(0);
  const [streamReady, setStreamReady] = useState(false);

  // connect socket
  useEffect(() => {
    const newSocket = io("http://localhost:8000");
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
      setVideos((prev) => {
        const exists = prev.find((v) => v.socketId === neighborId);
        return exists
          ? prev.map((v) =>
            v.socketId === neighborId ? { ...v, stream: remoteStream } : v
          )
          : [...prev, { socketId: neighborId, stream: remoteStream, videoEnabled: true }];
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
    socket.on("user-joined", async (id, clients) => {
      console.log("user-joined:", id, "clients:", clients);

      clients.forEach(async (clientId) => {
        if (clientId === socketIdRef.current) return;
        if (connections[clientId]) return;

        addConnection(clientId, null, async (pc) => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit(
            "signal",
            clientId,
            JSON.stringify({ sdp: pc.localDescription })
          );
        });
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
      const savedUsername = window.localStorage.getItem("video_call_username");
      if (savedUsername) {
        setUsername(savedUsername);
        // Do not auto-join, just pre-fill
      }
    }
  }, [socket, askForUsername, streamReady]);

  // Handle Video Toggle Listener in a separate effect or inside the existing one,
  // but we need 'setVideos' dependency.
  useEffect(() => {
    if (!socket) return;

    socket.on("video-toggle", (socketId, isAvailable) => {
      setVideos((prev) => {
        return prev.map((v) => {
          if (v.socketId === socketId) {
            return { ...v, videoEnabled: isAvailable };
          }
          return v;
        })
      })
    });

    // Cleanup for this specific listener if expected, but might be redundant if main useEffect handles socket disconnect well.
    return () => {
      socket.off("video-toggle");
    }
  }, [socket])

  const connect = () => {
    setAskForUsername(false);
    window.localStorage.setItem("video_call_username", username);
    socket.emit("join-call", window.location.href, username);
  };

  const handleEndCall = () => {
    window.localStorage.removeItem("video_call_username");
    window.location.reload();
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = enabled));
    setVideoAvailable(enabled);
    if (!askForUsername) {
      socket.emit("video-toggle", enabled);
    }
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = enabled));
    setAudioAvailable(enabled);

    // We don't have an audio-toggle event on server yet usually, but if we did:
    // if (!askForUsername) socket.emit("audio-toggle", enabled);
  };

  return (
    <div>
      {askForUsername ? (
        <div style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #121212 0%, #1e1e1e 100%)",
          color: "white"
        }}>
          <div style={{
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(10px)",
            borderRadius: "24px",
            padding: "40px",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
            maxWidth: "500px",
            width: "90%"
          }}>
            <h2 style={{ margin: 0, fontWeight: 600, fontSize: "2rem" }}>Ready to join?</h2>

            <div style={{ position: "relative", width: "100%", borderRadius: "16px", overflow: "hidden", aspectRatio: "16/9", background: "#000" }}>
              {videoAvailable ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: deepOrange[500] }}>
                    {username ? username[0]?.toUpperCase() : "U"}
                  </Avatar>
                </div>
              )}

              <div style={{
                position: "absolute",
                bottom: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "16px",
                background: "rgba(0,0,0,0.6)",
                padding: "8px 16px",
                borderRadius: "30px"
              }}>
                <IconButton onClick={toggleAudio} style={{ color: "white", background: audioAvailable ? "rgba(255,255,255,0.2)" : "#ef4444" }}>
                  {audioAvailable ? <MicIcon /> : <MicOffIcon />}
                </IconButton>
                <IconButton onClick={toggleVideo} style={{ color: "white", background: videoAvailable ? "rgba(255,255,255,0.2)" : "#ef4444" }}>
                  {videoAvailable ? <VideocamIcon /> : <VideocamOffIcon />}
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
                padding: "12px",
                fontSize: "1.1rem",
                textTransform: "none",
                background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
                boxShadow: "0 3px 5px 2px rgba(33, 203, 243, .3)",
              }}
            >
              Join Meeting
            </Button>
          </div>
        </div>
      ) : (
        <div className="meetVideoContainer">
          <div className="buttonContainers">
            <IconButton onClick={toggleVideo} style={{ color: "white", backgroundColor: videoAvailable ? "transparent" : "#ef4444" }}>
              {videoAvailable ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton onClick={handleEndCall} style={{ color: "white", backgroundColor: "#ef4444" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={toggleAudio} style={{ color: "white", backgroundColor: audioAvailable ? "transparent" : "#ef4444" }}>
              {audioAvailable ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          {videoAvailable ? (
            <video
              className="meetUserVideo"
              ref={(v) => {
                if (v && localStreamRef.current)
                  v.srcObject = localStreamRef.current;
              }}
              autoPlay
              muted
              playsInline
            />
          ) : (
            <div className="meetUserVideo" style={{ background: "black", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Avatar sx={{ bgcolor: stringToColor(username || "Local") }}>
                {username ? username.substring(0, 2).toUpperCase() : "U"}
              </Avatar>
            </div>
          )}

          <div className={`conferenceView ${videos.length === 0 ? 'single-user' : ''}`}>
            {videos.length === 0 ? (
              <div className="video-wrapper">
                <div className="avatar-container">
                  <h2>Waiting for others to join...</h2>
                </div>
              </div>
            ) : (
              videos.map((video) => (
                <div key={video.socketId} className="video-wrapper">
                  <div className="avatar-container" style={{
                    background: "black",
                    width: "100%",
                    height: "100%",
                    display: !video.videoEnabled ? "flex" : "none",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 1
                  }}>
                    <Avatar sx={{ bgcolor: stringToColor(video.socketId || "Remote") }}>
                      {video.socketId ? video.socketId.substring(0, 2).toUpperCase() : "U"}
                    </Avatar>
                  </div>
                  <video
                    data-socket={video.socketId}
                    ref={(ref) => {
                      if (ref && video.stream) {
                        ref.srcObject = video.stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: video.videoEnabled ? "block" : "none"
                    }} // Keep video mounted to play audio
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoMeet;
