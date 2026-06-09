import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  groupMessages: [],
  isGroupsLoading: false,
  isGroupMessagesLoading: false,
  isGroupTyping: false,
  groupTypingUser: null,
  // Reply state for groups
  replyingTo: null,

  getMyGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      set({ groups: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async ({ name, description, memberIds, groupPic }) => {
    try {
      const res = await axiosInstance.post("/groups", { name, description, memberIds, groupPic });
      set({ groups: [res.data, ...get().groups] });
      toast.success("Group created!");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return null;
    }
  },

  getGroupMessages: async (groupId) => {
    set({ isGroupMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}/messages`);
      set({ groupMessages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load group messages");
    } finally {
      set({ isGroupMessagesLoading: false });
    }
  },

  sendGroupMessage: async (groupId, messageData) => {
    const { groupMessages, replyingTo } = get();
    try {
      const payload = { ...messageData, replyToId: replyingTo?._id || null };
      const res = await axiosInstance.post(`/groups/${groupId}/messages`, payload);
      set({ groupMessages: [...groupMessages, res.data], replyingTo: null });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message");
    }
  },

  addGroupMember: async (groupId, userId) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/members`, { userId });
      set({
        groups: get().groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: res.data,
      });
      toast.success("Member added!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add member");
    }
  },

  removeGroupMember: async (groupId, userId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${userId}`);
      set({
        groups: get().groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: res.data,
      });
      toast.success("Member removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  },

  updateGroup: async (groupId, data) => {
    try {
      const res = await axiosInstance.put(`/groups/${groupId}`, data);
      set({
        groups: get().groups.map((g) => (g._id === groupId ? res.data : g)),
        selectedGroup: res.data,
      });
      toast.success("Group updated!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),
  clearReplyingTo: () => set({ replyingTo: null }),

  setSelectedGroup: (group) => {
    set({ selectedGroup: group, groupMessages: [], replyingTo: null });
  },

  subscribeToGroupMessages: (groupId) => {
    const socket = useAuthStore.getState().socket;
    socket.emit("joinGroup", { groupId });

    socket.on("newGroupMessage", ({ groupId: gId, message }) => {
      if (gId !== groupId) return;
      set({ groupMessages: [...get().groupMessages, message] });
    });

    socket.on("groupUpdated", (updatedGroup) => {
      set({
        groups: get().groups.map((g) => (g._id === updatedGroup._id ? updatedGroup : g)),
        selectedGroup: get().selectedGroup?._id === updatedGroup._id ? updatedGroup : get().selectedGroup,
      });
    });

    socket.on("removedFromGroup", ({ groupId: gId }) => {
      set({
        groups: get().groups.filter((g) => g._id !== gId),
        selectedGroup: get().selectedGroup?._id === gId ? null : get().selectedGroup,
      });
      toast.error("You were removed from a group");
    });

    socket.on("groupCreated", (group) => {
      const exists = get().groups.find((g) => g._id === group._id);
      if (!exists) set({ groups: [group, ...get().groups] });
    });

    socket.on("groupUserTyping", ({ senderId, groupId: gId }) => {
      if (gId === groupId) set({ isGroupTyping: true, groupTypingUser: senderId });
    });

    socket.on("groupUserStopTyping", ({ groupId: gId }) => {
      if (gId === groupId) set({ isGroupTyping: false, groupTypingUser: null });
    });
  },

  unsubscribeFromGroupMessages: (groupId) => {
    const socket = useAuthStore.getState().socket;
    socket.emit("leaveGroup", { groupId });
    socket.off("newGroupMessage");
    socket.off("groupUpdated");
    socket.off("removedFromGroup");
    socket.off("groupCreated");
    socket.off("groupUserTyping");
    socket.off("groupUserStopTyping");
    set({ isGroupTyping: false, groupTypingUser: null, replyingTo: null });
  },
}));
