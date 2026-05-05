const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

// roomId -> Set of socketIds
const rooms = new Map();
// socketId -> { roomId, userName }
const peers = new Map();

io.on("connection", (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Join a room
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    rooms.get(roomId).add(socket.id);
    peers.set(socket.id, { roomId, userName });

    // Notify existing peers
    socket.to(roomId).emit("user-joined", { socketId: socket.id, userName });

    // Send existing peers list to new joiner
    const existingPeers = [...rooms.get(roomId)]
      .filter((id) => id !== socket.id)
      .map((id) => ({ socketId: id, userName: peers.get(id)?.userName }));

    socket.emit("room-peers", existingPeers);

    console.log(`[Room ${roomId}] ${userName} joined (${rooms.get(roomId).size} peers)`);
  });

  // WebRTC signaling
  socket.on("offer", ({ to, offer }) => {
    socket.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    socket.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("ice-candidate", ({ to, candidate }) => {
    socket.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });

  // Chat messages
  socket.on("chat-message", ({ roomId, message, userName }) => {
    io.to(roomId).emit("chat-message", {
      from: socket.id,
      userName,
      message,
      timestamp: Date.now(),
    });
  });

  // Media state changes
  socket.on("toggle-audio", ({ roomId, enabled }) => {
    socket.to(roomId).emit("peer-audio-toggle", { socketId: socket.id, enabled });
  });

  socket.on("toggle-video", ({ roomId, enabled }) => {
    socket.to(roomId).emit("peer-video-toggle", { socketId: socket.id, enabled });
  });

  // Screen share
  socket.on("screen-share-started", ({ roomId }) => {
    socket.to(roomId).emit("peer-screen-share", { socketId: socket.id, sharing: true });
  });

  socket.on("screen-share-stopped", ({ roomId }) => {
    socket.to(roomId).emit("peer-screen-share", { socketId: socket.id, sharing: false });
  });

  // Disconnect
  socket.on("disconnect", () => {
    const peer = peers.get(socket.id);
    if (peer) {
      const { roomId, userName } = peer;
      socket.to(roomId).emit("user-left", { socketId: socket.id, userName });

      const room = rooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) rooms.delete(roomId);
      }
      peers.delete(socket.id);
      console.log(`[-] ${userName} left room ${roomId}`);
    }
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
