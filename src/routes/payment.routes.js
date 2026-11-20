import express from "express";

import {
  createCheckoutSessionController,
  verifyPaymentController,
  getCustomerPaymentHistoryController,
  getPaymentByBookingIdController,
  getAllPaymentsController,
} from "../controllers/payment.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// 1. Create Stripe Checkout Session (Customer)
router.post(
  "/checkout",
  authenticate,
  authorizeRoles("customer"),
  createCheckoutSessionController
);

// 2. Verify Payment (Customer)
router.post(
  "/verify",
  authenticate,
  authorizeRoles("customer"),
  verifyPaymentController
);

// 3. Get Customer Payment History
router.get(
  "/history",
  authenticate,
  authorizeRoles("customer"),
  getCustomerPaymentHistoryController
);

// 4. Get Payment by Booking ID
router.get(
  "/booking/:bookingId",
  authenticate,
  getPaymentByBookingIdController
);

// 5. Get All Payments (Admin)
router.get(
  "/all",
  authenticate,
  authorizeRoles("admin"),
  getAllPaymentsController
);

export default router;