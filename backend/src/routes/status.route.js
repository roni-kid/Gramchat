import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getStatuses,
  createStatus,
  viewStatus,
  deleteStatus,
} from "../controllers/status.controller.js";

const router = express.Router();

router.get("/", protectRoute, getStatuses);
router.post("/", protectRoute, createStatus);
router.post("/view/:statusId", protectRoute, viewStatus);
router.delete("/:statusId", protectRoute, deleteStatus);

export default router;
