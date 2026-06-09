import Group from "../models/group.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

// Get all groups the logged-in user belongs to
export const getMyGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({ members: userId })
      .populate("members", "-password")
      .populate("admin", "-password")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });
    res.status(200).json(groups);
  } catch (error) {
    console.log("Error in getMyGroups:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Create a new group
export const createGroup = async (req, res) => {
  try {
    const { name, description, memberIds, groupPic } = req.body;
    const adminId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required" });
    }

    // Always include the admin in members
    const allMembers = [...new Set([adminId.toString(), ...(memberIds || [])])];

    let groupPicUrl = "";
    if (groupPic) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic);
      groupPicUrl = uploadResponse.secure_url;
    }

    const group = new Group({
      name: name.trim(),
      description: description || "",
      groupPic: groupPicUrl,
      admin: adminId,
      members: allMembers,
    });

    await group.save();
    await group.populate("members", "-password");
    await group.populate("admin", "-password");

    // Notify all members via socket that they were added to a group
    allMembers.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId.toString());
      if (socketId) {
        io.to(socketId).emit("groupCreated", group);
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.log("Error in createGroup:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get messages for a group
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    // Verify membership
    const group = await Group.findOne({ _id: groupId, members: userId });
    if (!group) return res.status(403).json({ message: "Not a member of this group" });

    const messages = await Message.find({ groupId })
      .populate("senderId", "fullName profilePic")
      .populate("replyTo", "text image fileName senderId")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getGroupMessages:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Send a message to a group
export const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { text, image, fileUrl, fileType, fileName, fileSize, replyToId } = req.body;
    const senderId = req.user._id;

    // Verify membership
    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) return res.status(403).json({ message: "Not a member of this group" });

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, { resource_type: "auto" });
      imageUrl = uploadResponse.secure_url;
    }

    let uploadedFileUrl;
    if (fileUrl) {
      const uploadResponse = await cloudinary.uploader.upload(fileUrl, {
        resource_type: "auto",
        folder: "gramchat_files",
      });
      uploadedFileUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      groupId,
      text,
      image: imageUrl,
      fileUrl: uploadedFileUrl,
      fileType,
      fileName,
      fileSize,
      replyTo: replyToId || null,
    });

    await newMessage.save();
    await newMessage.populate("senderId", "fullName profilePic");
    await newMessage.populate("replyTo", "text image fileName senderId");

    // Update group's lastMessage
    group.lastMessage = newMessage._id;
    await group.save();

    // Broadcast to all group members' sockets
    group.members.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId.toString());
      if (socketId) {
        io.to(socketId).emit("newGroupMessage", { groupId, message: newMessage });
      }
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendGroupMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Add member to group (admin only)
export const addGroupMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    const adminId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can add members" });
    if (group.members.map((m) => m.toString()).includes(userId))
      return res.status(400).json({ message: "User already in group" });

    group.members.push(userId);
    await group.save();
    await group.populate("members", "-password");
    await group.populate("admin", "-password");

    // Notify new member
    const socketId = getReceiverSocketId(userId);
    if (socketId) io.to(socketId).emit("groupCreated", group);

    // Notify all existing members
    group.members.forEach((member) => {
      const sid = getReceiverSocketId(member._id.toString());
      if (sid) io.to(sid).emit("groupUpdated", group);
    });

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in addGroupMember:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Remove member from group (admin only, or self-leave)
export const removeGroupMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const requesterId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });

    const isSelf = requesterId.toString() === userId;
    const isAdmin = group.admin.toString() === requesterId.toString();

    if (!isSelf && !isAdmin)
      return res.status(403).json({ message: "Not authorized" });

    group.members = group.members.filter((m) => m.toString() !== userId);

    // If admin leaves, assign next member as admin
    if (isAdmin && isSelf && group.members.length > 0) {
      group.admin = group.members[0];
    }

    await group.save();
    await group.populate("members", "-password");

    group.members.forEach((member) => {
      const sid = getReceiverSocketId(member._id.toString());
      if (sid) io.to(sid).emit("groupUpdated", group);
    });

    // Notify the removed user
    const removedSocketId = getReceiverSocketId(userId);
    if (removedSocketId) io.to(removedSocketId).emit("removedFromGroup", { groupId });

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in removeGroupMember:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update group info (admin only)
export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, groupPic } = req.body;
    const adminId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: "Group not found" });
    if (group.admin.toString() !== adminId.toString())
      return res.status(403).json({ message: "Only admin can update group" });

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description;
    if (groupPic) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic);
      group.groupPic = uploadResponse.secure_url;
    }

    await group.save();
    await group.populate("members", "-password");
    await group.populate("admin", "-password");

    group.members.forEach((member) => {
      const sid = getReceiverSocketId(member._id.toString());
      if (sid) io.to(sid).emit("groupUpdated", group);
    });

    res.status(200).json(group);
  } catch (error) {
    console.log("Error in updateGroup:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
