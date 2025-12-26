import React, { useEffect, useRef, useState } from "react";
import Avatar from '@mui/material/Avatar';
import { deepOrange, deepPurple } from '@mui/material/colors';
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
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import { io } from "socket.io-client";

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
  const [showChat, setShowChat] = useState(false);
  const [streamReady, setStreamReady] = useState(false);
  const [screenSharerId, setScreenSharerId] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

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

    // Cleanup for this specific listener if expected, but might be redundant if main useEffect handles socket disconnect well.
    return () => {
      socket.off("video-toggle");
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("screen-share-denied");
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

  const startScreenShare = async () => {
    // 1. Request confirmation or check availability via socket first?
    // In this plan, we request server, server broadcasts 'screen-share-started'.
    // If we want to be strict, we 'ask' server, server says OK, then we getMedia.
    // Or we just try to getMedia, then tell server. If server says "NO", we stop.
    // The plan said: Emit request-screen-share. Wait for ACK or listen to 'screen-share-started'.

    // Let's optimistic: Ask for media first (user interaction required physically first often), 
    // OR Ask server lock first. 
    // Browser blocking popup usually needs user gesture. Click -> GetMedia is best.
    // Click -> Socket(Ask) -> Socket(OK) -> GetMedia works but latency might be weird or browser might block 'async' getDisplayMedia.

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

      // We will receive "screen-share-started" with our ID from server if success.
      // But we can start showing it locally or preparing. 
      // Actually we need to replace tracks in PeerConnections.

      setIsScreenSharing(true);

      // Replace track in all connections
      Object.values(connections).forEach((pc) => {
        const senders = pc.getSenders();
        const sender = senders.find(s => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Update local preview if we want (optional, usually users want to see what they share or just see others)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }
      localStreamRef.current = screenStream; // Keep track for new connections
      setVideoAvailable(true); // Screen share implies video is on

      // If we don't get 'screen-share-started' back (denied), we should handle that via listener to Revert.

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
      {askForUsername ? (
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

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 bg-black/60 px-4 py-2 rounded-full">
                <IconButton onClick={toggleAudio} className={`${audioAvailable ? "text-white bg-black hover:bg-black/80" : "text-red-500 bg-white hover:bg-gray-100"}`}>
                  {audioAvailable ? <MicIcon className="text-white" /> : <MicOffIcon className="bg-red-400 text-white" />}
                </IconButton>
                <IconButton onClick={toggleVideo} className={`${videoAvailable ? "text-white" : "bg-[#E5CDCB] text-[#4E342E] hover:bg-[#d7cccb]"}`}>
                  {videoAvailable ? <VideocamIcon className="text-white" /> : <VideocamOffIcon className="bg-red-400 text-white" />}
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
        <div className="relative h-screen w-screen bg-zinc-950 overflow-hidden flex justify-center items-center">
          {/* Controls Bar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-5 px-6 py-3 bg-black backdrop-blur-md rounded-full border border-white/20 shadow-2xl z-50 transition-all hover:-translate-y-1">
            <IconButton onClick={toggleVideo} className={`${videoAvailable ? "text-white bg-transparent hover:bg-white/10" : "bg-[#E5CDCB] text-[#4E342E] hover:bg-[#d7cccb]"}`}>
              {videoAvailable ? <VideocamIcon className="text-white bg-transparent hover:translate-y-1" /> : <VideocamOffIcon className="text-white bg-red-500 hover:bg-red-600 " />}
            </IconButton>

            <IconButton onClick={toggleAudio} className={`${audioAvailable ? "text-white bg-black hover:bg-black/80" : "text-red-500 bg-white hover:bg-gray-100"}`}>
              {audioAvailable ? <MicIcon className="text-white" /> : <MicOffIcon className="bg-red-500 text-white hover:bg-red-600" />}
            </IconButton>



            {!isScreenSharing ? (
              <IconButton
                onClick={startScreenShare}
                disabled={!!screenSharerId}
                className={`${!!screenSharerId ? "opacity-50 cursor-not-allowed" : ""} text-white hover:bg-white/10`}
              >
                <ScreenShareIcon className="text-white" />
              </IconButton>
            ) : (
              <IconButton onClick={stopScreenShare} className="text-red-500 hover:bg-white/10">
                <StopScreenShareIcon className="text-red-500" />
              </IconButton>
            )}

                        <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton onClick={() => setShowChat(!showChat)} className={`${showChat ? "text-blue-500" : "text-white"} hover:bg-white/10`}>
                <ChatIcon className="text-white hover:text-blue-500" />
              </IconButton>
            </Badge>
                        <IconButton onClick={handleEndCall} className="text-white bg-red-500 hover:bg-red-600">
              <CallEndIcon className="text-red-500 hover:text-red-600" />
            </IconButton>
          </div>

          {/* Local Video - Floating */}
          <div className={`absolute bottom-5 right-5 w-[250px] h-[150px] rounded-xl border-2 border-white/20 shadow-2xl overflow-hidden z-30 transition-all duration-300 bg-black hover:scale-105`}>
            {videoAvailable ? (
              <video
                className="w-full h-full object-cover"
                ref={(v) => {
                  if (v && localStreamRef.current)
                    v.srcObject = localStreamRef.current;
                }}
                autoPlay
                muted
                playsInline
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
              // HERO LAYOUT
              <div className="w-full h-full flex p-5 gap-5">

                {/* Main Hero Area (Shared Screen) */}
                <div className="flex-1 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative">
                  {(() => {
                    // Find the stream for screenSharerId
                    // If it's me:
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
                    // If remote
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

                {/* Sidebar for other participants */}
                <div className="w-[300px] flex flex-col gap-4 overflow-y-auto">
                  {/* Show Local User if not sharing (or if sharing, maybe small preview?) -> Usually we see ourselves small */}
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

                  {/* Other remote users who are NOT the sharer */}
                  {videos.filter(v => v.socketId !== screenSharerId).map((video) => (
                    <div key={video.socketId} className="relative aspect-video bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 shadow-md">
                      {!video.videoEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                          <Avatar sx={{ width: 40, height: 40, fontSize: '1rem', bgcolor: stringToColor(video.socketId) }}>
                            {video.socketId.substring(0, 2).toUpperCase()}
                          </Avatar>
                        </div>
                      )}
                      <video
                        ref={(v) => { if (v && video.stream) v.srcObject = video.stream; }}
                        autoPlay playsInline
                        className={`w-full h-full object-cover ${video.videoEnabled ? 'block' : 'hidden'}`}
                      />
                      <div className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded">{video.socketId}</div>
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
                    <div key={video.socketId} className={`relative rounded-2xl overflow-hidden bg-zinc-900 shadow-md flex justify-center items-center transition-all ${videos.length === 1 ? 'w-full h-full max-w-6xl' : 'flex-1 min-w-[45%] max-w-full max-h-[48%] aspect-video'}`}>
                      {!video.videoEnabled && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
                          <Avatar sx={{ bgcolor: stringToColor(video.socketId || "Remote"), width: 80, height: 80, fontSize: '2rem' }}>
                            {video.socketId ? video.socketId.substring(0, 2).toUpperCase() : "U"}
                          </Avatar>
                        </div>
                      )}
                      <video
                        data-socket={video.socketId}
                        ref={(ref) => {
                          if (ref && video.stream) {
                            ref.srcObject = video.stream;
                          }
                        }}
                        autoPlay
                        playsInline
                        className={`w-full h-full object-cover ${video.videoEnabled ? 'block' : 'hidden'}`}
                      />

                      <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded text-sm text-white pointer-events-none">
                        {video.socketId}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoMeet;
