import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

export const useCallStore = create((set, get) => ({
  callState: "idle",      // "idle" | "calling" | "incoming" | "active"
  callType: null,         // "voice" | "video"
  remoteUser: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  isCameraOff: false,
  callDuration: 0,
  durationInterval: null,
  _pendingOffer: null,
  // Queue for ICE candidates that arrive before remote description is set
  _iceCandidateQueue: [],

  // ── Build a peer connection with all handlers wired ───────────────────────
  _createPeerConnection: (remoteUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    const socket = useAuthStore.getState().socket;

    // As remote tracks arrive, add them to a live MediaStream and update state
    const remoteStream = new MediaStream();
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      // Force a state update so the video element re-renders with the new stream
      set({ remoteStream: new MediaStream(remoteStream.getTracks()) });
    };

    // Send ICE candidates to the remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("call:ice-candidate", {
          to: remoteUserId,
          candidate: event.candidate,
        });
      }
    };

    // Log connection state changes for debugging
    pc.onconnectionstatechange = () => {
      console.log("[WebRTC] connection state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        toast.error("Call connection lost");
        get()._cleanup();
      }
    };

    return { pc, remoteStream };
  },

  // ── Drain queued ICE candidates after remote description is set ────────────
  _drainIceCandidateQueue: async (pc) => {
    const queue = get()._iceCandidateQueue;
    if (queue.length === 0) return;
    console.log(`[WebRTC] draining ${queue.length} queued ICE candidates`);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[WebRTC] queued ICE candidate error:", err);
      }
    }
    set({ _iceCandidateQueue: [] });
  },

  // ── Start a call (we are the caller) ─────────────────────────────────────
  startCall: async (remoteUser, callType) => {
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;
    if (!socket) return;

    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });
    } catch (err) {
      toast.error("Could not access camera/microphone. Check browser permissions.");
      return;
    }

    const { pc, remoteStream } = get()._createPeerConnection(remoteUser._id);
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

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
      _iceCandidateQueue: [],
    });

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

  // ── Accept incoming call (we are the callee) ──────────────────────────────
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
      toast.error("Could not access camera/microphone. Check browser permissions.");
      get().rejectCall();
      return;
    }

    const { pc, remoteStream } = get()._createPeerConnection(remoteUser._id);
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    // Set remote description FIRST, then drain any queued ICE candidates
    await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
    await get()._drainIceCandidateQueue(pc);

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

  // ── Caller receives answer ────────────────────────────────────────────────
  handleCallAnswered: async (answer) => {
    const { peerConnection } = get();
    if (!peerConnection) return;
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      // Drain any ICE candidates that came in before the answer
      await get()._drainIceCandidateQueue(peerConnection);
      set({ callState: "active" });
      get()._startDurationTimer();
    } catch (err) {
      console.error("[WebRTC] handleCallAnswered error:", err);
      toast.error("Call setup failed");
      get()._cleanup();
    }
  },

  // ── Handle incoming ICE candidate ─────────────────────────────────────────
  handleIceCandidate: async (candidate) => {
    const { peerConnection } = get();
    if (!candidate) return;

    // If peer connection exists and remote description is set, add immediately
    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("[WebRTC] addIceCandidate error:", err);
      }
    } else {
      // Queue it — will be drained after remote description is set
      console.log("[WebRTC] queueing ICE candidate (no remote description yet)");
      set((state) => ({
        _iceCandidateQueue: [...state._iceCandidateQueue, candidate],
      }));
    }
  },

  // ── Reject incoming call ──────────────────────────────────────────────────
  rejectCall: () => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (socket && remoteUser) socket.emit("call:reject", { to: remoteUser._id });
    get()._cleanup();
  },

  // ── End active call ───────────────────────────────────────────────────────
  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const { remoteUser } = get();
    if (socket && remoteUser) socket.emit("call:end", { to: remoteUser._id });
    get()._cleanup();
  },

  // ── Toggle mute ───────────────────────────────────────────────────────────
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

  // ── Set incoming call info ────────────────────────────────────────────────
  setIncomingCall: ({ from, offer, callType, callerInfo }) => {
    set({
      callState: "incoming",
      callType,
      remoteUser: { _id: from, ...callerInfo },
      _pendingOffer: offer,
      _iceCandidateQueue: [],
    });
  },

  getPendingOffer: () => get()._pendingOffer,

  // ── Timer ─────────────────────────────────────────────────────────────────
  _startDurationTimer: () => {
    const interval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
    set({ durationInterval: interval, callDuration: 0 });
  },

  // ── Cleanup ───────────────────────────────────────────────────────────────
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
      _iceCandidateQueue: [],
    });
  },

  // ── Socket subscriptions ──────────────────────────────────────────────────
  subscribeToCallEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("call:incoming", ({ from, offer, callType, callerInfo }) => {
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

    socket.on("call:unavailable", () => {
      toast.error("User is not available");
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
