import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// Tracks online users: { userId: socketId }
const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ── DM Typing ────────────────────────────────────────────────────────────
  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) io.to(receiverSocketId).emit("userTyping", { senderId: userId });
  });

  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) io.to(receiverSocketId).emit("userStopTyping", { senderId: userId });
  });

  // ── Group Typing ─────────────────────────────────────────────────────────
  socket.on("groupTyping", ({ groupId }) => {
    socket.to(`group:${groupId}`).emit("groupUserTyping", { senderId: userId, groupId });
  });
  socket.on("groupStopTyping", ({ groupId }) => {
    socket.to(`group:${groupId}`).emit("groupUserStopTyping", { senderId: userId, groupId });
  });

  // ── Group Rooms ───────────────────────────────────────────────────────────
  socket.on("joinGroup", ({ groupId }) => socket.join(`group:${groupId}`));
  socket.on("leaveGroup", ({ groupId }) => socket.leave(`group:${groupId}`));

  // ── WebRTC Signaling ─────────────────────────────────────────────────────
  // Caller → Callee: initiate call
  socket.on("call:offer", ({ to, offer, callType, callerInfo }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:incoming", {
        from: userId,
        offer,
        callType,   // "voice" | "video"
        callerInfo, // { fullName, profilePic }
      });
    } else {
      // Target is offline
      socket.emit("call:unavailable", { to });
    }
  });

  // Callee → Caller: accepted
  socket.on("call:answer", ({ to, answer }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:answered", { answer });
    }
  });

  // Either side: rejected / hung up
  socket.on("call:reject", ({ to }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:rejected");
    }
  });

  socket.on("call:end", ({ to }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:ended");
    }
  });

  // ICE candidate exchange
  socket.on("call:ice-candidate", ({ to, candidate }) => {
    const receiverSocketId = userSocketMap[to];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:ice-candidate", { candidate });
    }
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
