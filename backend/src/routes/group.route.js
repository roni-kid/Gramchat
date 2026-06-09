import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getMyGroups,
  createGroup,
  getGroupMessages,
  sendGroupMessage,
  addGroupMember,
  removeGroupMember,
  updateGroup,
} from "../controllers/group.controller.js";

const router = express.Router();

router.get("/", protectRoute, getMyGroups);
router.post("/", protectRoute, createGroup);
router.get("/:groupId/messages", protectRoute, getGroupMessages);
router.post("/:groupId/messages", protectRoute, sendGroupMessage);
router.post("/:groupId/members", protectRoute, addGroupMember);
router.delete("/:groupId/members/:userId", protectRoute, removeGroupMember);
router.put("/:groupId", protectRoute, updateGroup);

export default router;
