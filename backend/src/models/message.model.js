import mongoose from "mongoose";

const reactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  emoji: { type: String, required: true },
});

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    text: {
      type: String,
    },
    image: {
      type: String,
    },
    // File attachments (documents, videos, audio, etc.)
    fileUrl: {
      type: String,
    },
    fileType: {
      type: String, // "pdf", "video", "audio", "document"
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    // Reply/quote a previous message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    // Emoji reactions: [{ userId, emoji }]
    reactions: [reactionSchema],
    // Read receipts (DM only)
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
