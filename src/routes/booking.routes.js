import express from "express";

import {
  createBookingController,
  getCustomerBookingsController,
  getTechnicianBookingsController,
  getBookingByIdController,
  updateBookingStatusController,
  updateFinalAmountController,
  cancelBookingController,
} from "../controllers/booking.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// 1. Create a new booking (Customer)
router.post(
  "/",
  authenticate,
  authorizeRoles("customer"),
  createBookingController
);

// 2. Get customer's bookings
router.get(
  "/customer",
  authenticate,
  authorizeRoles("customer"),
  getCustomerBookingsController
);

// 3. Get technician's bookings
router.get(
  "/technician",
  authenticate,
  authorizeRoles("technician"),
  getTechnicianBookingsController
);

// 4. Get booking by ID (Authenticated user)
router.get(
  "/:id",
  authenticate,
  getBookingByIdController
);

// 5. Update booking status (Technician)
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("technician"),
  updateBookingStatusController
);

// 6. Update final amount (Technician)
router.patch(
  "/:id/final-amount",
  authenticate,
  authorizeRoles("technician"),
  updateFinalAmountController
);

// 7. Cancel booking (Customer)
router.patch(
  "/:id/cancel",
  authenticate,
  authorizeRoles("customer"),
  cancelBookingController
);

export default router;