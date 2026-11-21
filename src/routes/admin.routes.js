import express from "express";

import {
  getUsersController,
  getUserByIdController,
  updateUserRoleController,
  getDashboardStatsController,
} from "../controllers/admin.controller.js";

import {
  getAllServicesController,
  approveServiceController,
  rejectServiceController,
} from "../controllers/service.controller.js";

import { getAllBookingsController } from "../controllers/booking.controller.js";
import { getAllPaymentsController } from "../controllers/payment.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticate, authorizeRoles("admin"));

// Users
router.get("/users", getUsersController);
router.get("/users/:id", getUserByIdController);
router.patch("/users/:id/role", updateUserRoleController);

// Services
router.get("/services", getAllServicesController);
router.patch("/services/:id/approve", approveServiceController);
router.patch("/services/:id/reject", rejectServiceController);

// Bookings
router.get("/bookings", getAllBookingsController);

// Payments
router.get("/payments", getAllPaymentsController);

// Dashboard
router.get("/stats", getDashboardStatsController);

export default router;
