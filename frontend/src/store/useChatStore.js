import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isTyping: false,
  // Reply-to state
  replyingTo: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages, replyingTo } = get();
    try {
      const payload = {
        ...messageData,
        replyToId: replyingTo?._id || null,
      };
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, payload);
      set({ messages: [...messages, res.data], replyingTo: null });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  addReaction: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/react/${messageId}`, { emoji });
      // Update the reaction on the local message
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, reactions: res.data.reactions } : m
        ),
      });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add reaction");
    }
  },

  markMessagesAsRead: async (userId) => {
    try {
      await axiosInstance.put(`/messages/read/${userId}`);
    } catch (error) {
      console.log("Error marking messages as read:", error.message);
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),
  clearReplyingTo: () => set({ replyingTo: null }),

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      if (newMessage.senderId !== selectedUser._id) return;
      set({ messages: [...get().messages, newMessage] });
      get().markMessagesAsRead(selectedUser._id);
    });

    socket.on("messagesRead", ({ readBy }) => {
      set({
        messages: get().messages.map((m) =>
          m.receiverId === readBy ? { ...m, isRead: true } : m
        ),
      });
    });

    socket.on("messageReaction", ({ messageId, reactions }) => {
      set({
        messages: get().messages.map((m) =>
          m._id === messageId ? { ...m, reactions } : m
        ),
      });
    });

    socket.on("userTyping", ({ senderId }) => {
      if (senderId === selectedUser._id) set({ isTyping: true });
    });

    socket.on("userStopTyping", ({ senderId }) => {
      if (senderId === selectedUser._id) set({ isTyping: false });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("messagesRead");
    socket.off("messageReaction");
    socket.off("userTyping");
    socket.off("userStopTyping");
    set({ isTyping: false, replyingTo: null });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
