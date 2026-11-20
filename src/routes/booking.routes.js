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

const router = express.Router();

// 1. Create a new booking
router.post("/", createBookingController);

// 2. Get customer's bookings
router.get("/customer", getCustomerBookingsController);

// 3. Get technician's bookings
router.get("/technician", getTechnicianBookingsController);

// 4. Get booking by ID
router.get("/:id", getBookingByIdController);

// 5. Update booking status
router.patch("/:id/status", updateBookingStatusController);

// 6. Update final amount
router.patch("/:id/final-amount", updateFinalAmountController);

// 7. Cancel booking
router.patch("/:id/cancel", cancelBookingController);

export default router;