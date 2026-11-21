import express from "express";

import {
  getProfileController,
  updateProfileController,
  uploadProfileImageController,
} from "../controllers/profile.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { uploadProfileImage } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/", getProfileController);
router.patch("/", updateProfileController);
router.patch("/image", uploadProfileImage, uploadProfileImageController);

export default router;
