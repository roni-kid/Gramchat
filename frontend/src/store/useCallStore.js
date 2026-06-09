import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

// Google public STUN servers — free, no setup needed
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export const useCallStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  callState: "idle",        // "idle" | "calling" | "incoming" | "active"
  callType: null,           // "voice" | "video"
  remoteUser: null,         // { _id, fullName, profilePic }
  localStream: null,        // MediaStream
  remoteStream: null,       // MediaStream
  peerConnection: null,     // RTCPeerConnection
  isMuted: false,
  isCameraOff: false,
  callDuration: 0,          // seconds
  durationInterval: null,

  // ── Initiate a call (we are the caller) ──────────────────────────────────
  startCall: async (remoteUser, callType) => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket) return;

    // Acquire local media
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
    } catch (err) {
      toast.error("Could not access camera/microphone");
      console.error("getUserMedia error:", err);
      return;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to peer connection
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Collect remote tracks into a MediaStream
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      set({ remoteStream });
    };

    // ICE candidate handler — send to remote peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("call:ice-candidate", {
          to: remoteUser._id,
          candidate: event.candidate,
        });
      }
    };

    // Create SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    set({
      callState: "calling",
      callType,
      remoteUser,
      localStream,
      remoteStream,
      peerConnection: pc,
      isMuted: false,
      isCameraOff: false,
    });

    // Send offer to callee
    socket.emit("call:offer", {
      to: remoteUser._id,
      offer,
      callType,
      callerInfo: {
        fullName: authUser.fullName,
        profilePic: authUser.profilePic,
      },
    });
  },

  // ── Accept an incoming call (we are the callee) ───────────────────────────
  acceptCall: async (incomingOffer, callType) => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (!socket || !remoteUser) return;

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
    } catch (err) {
      toast.error("Could not access camera/microphone");
      get().rejectCall();
      return;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      set({ remoteStream });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("call:ice-candidate", {
          to: remoteUser._id,
          candidate: event.candidate,
        });
      }
    };

    // Set remote offer, create answer
    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    set({
      callState: "active",
      callType,
      localStream,
      remoteStream,
      peerConnection: pc,
      isMuted: false,
      isCameraOff: false,
    });

    get()._startDurationTimer();

    socket.emit("call:answer", {
      to: remoteUser._id,
      answer,
    });
  },

  // ── Called when remote peer accepted our offer ────────────────────────────
  handleCallAnswered: async (answer) => {
    const { peerConnection } = get();
    if (!peerConnection) return;
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      set({ callState: "active" });
      get()._startDurationTimer();
    } catch (err) {
      console.error("Error setting remote answer:", err);
    }
  },

  // ── Add ICE candidate from remote ────────────────────────────────────────
  handleIceCandidate: async (candidate) => {
    const { peerConnection } = get();
    if (!peerConnection || !candidate) return;
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Error adding ICE candidate:", err);
    }
  },

  // ── Reject incoming call ─────────────────────────────────────────────────
  rejectCall: () => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (socket && remoteUser) {
      socket.emit("call:reject", { to: remoteUser._id });
    }
    get()._cleanup();
  },

  // ── End active call ───────────────────────────────────────────────────────
  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (socket && remoteUser) {
      socket.emit("call:end", { to: remoteUser._id });
    }
    get()._cleanup();
  },

  // ── Toggle mute ──────────────────────────────────────────────────────────
  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    set({ isMuted: !isMuted });
  },

  // ── Toggle camera ─────────────────────────────────────────────────────────
  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = isCameraOff));
    set({ isCameraOff: !isCameraOff });
  },

  // ── Set incoming call info (called from socket listener in useAuthStore) ──
  setIncomingCall: ({ from, offer, callType, callerInfo }) => {
    set({
      callState: "incoming",
      callType,
      remoteUser: { _id: from, ...callerInfo },
      _pendingOffer: offer,
    });
  },

  // ── Get pending offer (used by acceptCall) ────────────────────────────────
  getPendingOffer: () => get()._pendingOffer,

  // ── Internal: start call timer ────────────────────────────────────────────
  _startDurationTimer: () => {
    const interval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
    set({ durationInterval: interval, callDuration: 0 });
  },

  // ── Internal: clean up everything ────────────────────────────────────────
  _cleanup: () => {
    const { localStream, peerConnection, durationInterval } = get();
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    if (peerConnection) peerConnection.close();
    if (durationInterval) clearInterval(durationInterval);
    set({
      callState: "idle",
      callType: null,
      remoteUser: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMuted: false,
      isCameraOff: false,
      callDuration: 0,
      durationInterval: null,
      _pendingOffer: null,
    });
  },

  // ── Subscribe to socket call events ──────────────────────────────────────
  subscribeToCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("call:incoming", ({ from, offer, callType, callerInfo }) => {
      // Ignore if already in a call
      if (get().callState !== "idle") {
        socket.emit("call:reject", { to: from });
        return;
      }
      get().setIncomingCall({ from, offer, callType, callerInfo });
    });

    socket.on("call:answered", ({ answer }) => {
      get().handleCallAnswered(answer);
    });

    socket.on("call:rejected", () => {
      toast.error("Call declined");
      get()._cleanup();
    });

    socket.on("call:ended", () => {
      if (get().callState !== "idle") {
        toast("Call ended", { icon: "📞" });
        get()._cleanup();
      }
    });

    socket.on("call:unavailable", ({ to }) => {
      toast.error("User is not online");
      get()._cleanup();
    });

    socket.on("call:ice-candidate", ({ candidate }) => {
      get().handleIceCandidate(candidate);
    });
  },

  unsubscribeFromCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("call:incoming");
    socket.off("call:answered");
    socket.off("call:rejected");
    socket.off("call:ended");
    socket.off("call:unavailable");
    socket.off("call:ice-candidate");
  },
}));
