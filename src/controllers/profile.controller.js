import {
  getUserByIdOrEmail,
  updateUserProfile,
} from "../models/user.model.js";
import { uploadImageToImgBB } from "../services/imgbb.service.js";
import { AppError } from "../utils/errors.js";
import { sendControllerError } from "../utils/controller.js";

// 1. Get authenticated user's profile
export const getProfileController = async (req, res) => {
  try {
    const user = await getUserByIdOrEmail({
      id: req.user.id,
      email: req.user.email,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile retrieved successfully",
      user,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 2. Update authenticated user's profile
export const updateProfileController = async (req, res) => {
  try {
    const body = req.body || {};

    const updatedUser = await updateUserProfile(req.user.id, {
      name: body.name,
      phone: body.phone,
      area: body.area,
      bio: body.bio,
      image: body.image,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 3. Upload and update profile image
export const uploadProfileImageController = async (req, res) => {
  try {
    if (!req.file) {
      throw new AppError("Image file is required", 400);
    }

    const imageUrl = await uploadImageToImgBB(req.file);

    const updatedUser = await updateUserProfile(req.user.id, {
      image: imageUrl,
    });

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile image updated successfully",
      imageUrl,
      user: updatedUser,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};
