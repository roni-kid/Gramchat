import Status from "../models/status.model.js";
import User from "../models/user.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

// Get statuses from contacts (people the current user can see)
export const getStatuses = async (req, res) => {
  try {
    const myId = req.user._id;

    // Get all user IDs except me
    const otherUsers = await User.find({ _id: { $ne: myId } }).select("_id");
    const otherUserIds = otherUsers.map((u) => u._id);

    // Include my own statuses too
    const allUserIds = [myId, ...otherUserIds];

    const now = new Date();
    const statuses = await Status.find({
      userId: { $in: allUserIds },
      expiresAt: { $gt: now },
    })
      .populate("userId", "fullName profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(statuses);
  } catch (error) {
    console.log("Error in getStatuses:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Post a new status
export const createStatus = async (req, res) => {
  try {
    const { text, image, bgColor } = req.body;
    const userId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Status must have text or image" });
    }

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const status = new Status({
      userId,
      text,
      image: imageUrl,
      bgColor: bgColor || "#1a1a2e",
    });

    await status.save();
    await status.populate("userId", "fullName profilePic");

    // Notify all online users of new status
    io.emit("newStatus", status);

    res.status(201).json(status);
  } catch (error) {
    console.log("Error in createStatus:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Mark a status as viewed
export const viewStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const viewerId = req.user._id;

    const status = await Status.findById(statusId);
    if (!status) return res.status(404).json({ message: "Status not found" });

    // Don't add duplicate views
    if (!status.viewedBy.map((id) => id.toString()).includes(viewerId.toString())) {
      status.viewedBy.push(viewerId);
      await status.save();

      // Notify status owner
      const ownerSocketId = getReceiverSocketId(status.userId.toString());
      if (ownerSocketId) {
        io.to(ownerSocketId).emit("statusViewed", {
          statusId,
          viewerId: viewerId.toString(),
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error in viewStatus:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Delete own status
export const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    const userId = req.user._id;

    const status = await Status.findOneAndDelete({ _id: statusId, userId });
    if (!status) return res.status(404).json({ message: "Status not found" });

    io.emit("statusDeleted", { statusId });
    res.status(200).json({ success: true });
  } catch (error) {
    console.log("Error in deleteStatus:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
