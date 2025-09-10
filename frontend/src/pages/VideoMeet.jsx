import React, { useEffect, useRef, useState } from "react";
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
let connections = {};

const VideoMeet = () => {
  const [socket, setSocket] = useState(null);
  const socketIdRef = useRef();
  const localVideoRef = useRef();
  const localStreamRef = useRef(null);

  const [videoAvailable, setVideoAvailable] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(false);
  const [videos, setVideos] = useState([]);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState("");
  const [newMessages] = useState(0);

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
    } catch (err) {
      console.error("Permission error:", err);
      setVideoAvailable(false);
      setAudioAvailable(false);

      const fakeStream = new MediaStream([black(), silence()]);
      localStreamRef.current = fakeStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = fakeStream;
    }
  };

  const gotMessageFromServer = async (fromId, message) => {
    if (fromId === socketIdRef.current) return;
    const signal = typeof message === "string" ? JSON.parse(message) : message;

    const pc = connections[fromId];
    if (!pc) return;

    if (signal.sdp) {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      if (signal.sdp.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit(
          "signal",
          fromId,
          JSON.stringify({ sdp: pc.localDescription })
        );
      }
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

        const pc = new RTCPeerConnection(peerConfigConnections);
        connections[clientId] = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit(
              "signal",
              clientId,
              JSON.stringify({ ice: event.candidate })
            );
          }
        };

        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          setVideos((prev) => {
            const exists = prev.find((v) => v.socketId === clientId);
            return exists
              ? prev.map((v) =>
                  v.socketId === clientId ? { ...v, stream: remoteStream } : v
                )
              : [...prev, { socketId: clientId, stream: remoteStream }];
          });
        };

        if (localStreamRef.current) {
          localStreamRef.current
            .getTracks()
            .forEach((track) => pc.addTrack(track, localStreamRef.current));
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit(
          "signal",
          clientId,
          JSON.stringify({ sdp: pc.localDescription })
        );
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

  const connect = () => {
    setAskForUsername(false);
    socket.emit("join-call", window.location.href, username);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = stream.getVideoTracks();
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = enabled));
    setVideoAvailable(enabled);
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const tracks = stream.getAudioTracks();
    if (!tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = enabled));
    setAudioAvailable(enabled);
  };

  return (
    <div>
      {askForUsername ? (
        <div>
          <h2>Enter into lobby</h2>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            variant="outlined"
          />
          <Button variant="contained" onClick={connect}>
            Connect
          </Button>
          <div>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{ width: 240, height: 180 }}
            />
          </div>
        </div>
      ) : (
        <div className="meetVideoContainer">
          <div className="buttonContainers">
            <IconButton onClick={toggleVideo} style={{ color: "white" }}>
              {videoAvailable ? <VideocamIcon /> : <VideocamOffIcon />}
            </IconButton>
            <IconButton style={{ color: "red" }}>
              <CallEndIcon />
            </IconButton>
            <IconButton onClick={toggleAudio} style={{ color: "white" }}>
              {audioAvailable ? <MicIcon /> : <MicOffIcon />}
            </IconButton>
            <Badge badgeContent={newMessages} max={999} color="secondary">
              <IconButton style={{ color: "white" }}>
                <ChatIcon />
              </IconButton>
            </Badge>
          </div>

          <video
            className="meetUserVideo"
            ref={(v) => {
              if (v && localStreamRef.current)
                v.srcObject = localStreamRef.current;
            }}
            autoPlay
            muted
            playsInline
            style={{ width: 320, height: 240 }}
          />

          <div className="conferenceView">
            {videos.map((video) => (
              <div key={video.socketId}>
                <h4>{video.socketId}</h4>
                <video
                  data-socket={video.socketId}
                  ref={(ref) => {
                    if (ref && video.stream) {
                      ref.srcObject = video.stream;
                    }
                  }}
                  autoPlay
                  playsInline
                  style={{ width: 240, height: 180 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoMeet;
