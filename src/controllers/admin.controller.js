import {
  getUserById,
  getUsers,
  updateUserRole,
  countAdmins,
  validateUserRole,
} from "../models/user.model.js";
import { getDashboardStats } from "../models/admin.model.js";
import { AppError } from "../utils/errors.js";
import { sendControllerError } from "../utils/controller.js";
import { isObjectId, requireString } from "../utils/validate.js";

// 1. Get all users
export const getUsersController = async (req, res) => {
  try {
    const { role, search } = req.query;

    validateUserRole(role);

    const users = await getUsers({
      role,
      search: search
        ? requireString(search, "Search", { max: 100 })
        : undefined,
    });

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 2. Get user details
export const getUserByIdController = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      throw new AppError("User ID is invalid", 400);
    }

    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      user,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 3. Update user role
export const updateUserRoleController = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      throw new AppError("User ID is invalid", 400);
    }

    const role = requireString(req.body?.role, "Role", { max: 20 });

    validateUserRole(role);

    if (req.params.id === req.user.id) {
      throw new AppError("You cannot change your own role", 400);
    }

    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin" && role !== "admin") {
      const adminCount = await countAdmins();

      if (adminCount <= 1) {
        throw new AppError("At least one admin account must remain", 400);
      }
    }

    const updatedUser = await updateUserRole(req.params.id, role);

    res.status(200).json({
      success: true,
      message: "User role updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 4. Get admin dashboard statistics
export const getDashboardStatsController = async (req, res) => {
  try {
    const stats = await getDashboardStats();

    res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      stats,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};
