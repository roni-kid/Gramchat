import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).populate("replyTo", "text image fileName senderId");

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, fileUrl, fileType, fileName, fileSize, replyToId } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
        resource_type: "auto",
      });
      imageUrl = uploadResponse.secure_url;
    }

    let uploadedFileUrl;
    if (fileUrl) {
      // fileUrl comes as base64 for docs/videos
      const uploadResponse = await cloudinary.uploader.upload(fileUrl, {
        resource_type: "auto",
        folder: "gramchat_files",
      });
      uploadedFileUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      fileUrl: uploadedFileUrl,
      fileType,
      fileName,
      fileSize,
      replyTo: replyToId || null,
    });

    await newMessage.save();

    // Populate replyTo for the response
    await newMessage.populate("replyTo", "text image fileName senderId");

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const myId = req.user._id;

    await Message.updateMany(
      { senderId, receiverId: myId, isRead: false },
      { isRead: true }
    );

    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesRead", { readBy: myId.toString() });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error in markMessagesAsRead controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addReaction = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Remove existing reaction from this user (toggle off same emoji)
    const existingIdx = message.reactions.findIndex(
      (r) => r.userId.toString() === userId.toString()
    );

    if (existingIdx !== -1) {
      if (message.reactions[existingIdx].emoji === emoji) {
        // Same emoji — remove it (toggle off)
        message.reactions.splice(existingIdx, 1);
      } else {
        // Different emoji — replace
        message.reactions[existingIdx].emoji = emoji;
      }
    } else {
      message.reactions.push({ userId, emoji });
    }

    await message.save();

    // Notify the other party in real-time
    const otherUserId =
      message.senderId.toString() === userId.toString()
        ? message.receiverId?.toString()
        : message.senderId.toString();

    const otherSocketId = getReceiverSocketId(otherUserId);
    if (otherSocketId) {
      io.to(otherSocketId).emit("messageReaction", {
        messageId,
        reactions: message.reactions,
      });
    }

    // Also notify the sender if reacting to own message in group (for DMs this handles it)
    const senderSocketId = getReceiverSocketId(userId.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageReaction", {
        messageId,
        reactions: message.reactions,
      });
    }

    res.status(200).json({ reactions: message.reactions });
  } catch (error) {
    console.log("Error in addReaction controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
