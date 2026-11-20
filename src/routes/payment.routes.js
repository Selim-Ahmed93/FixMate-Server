import express from "express";

import {
  createCheckoutSessionController,
  verifyPaymentController,
  getCustomerPaymentHistoryController,
  getPaymentByBookingIdController,
  getAllPaymentsController,
} from "../controllers/payment.controller.js";

const router = express.Router();

// 1. Create Stripe Checkout Session
router.post("/checkout", createCheckoutSessionController);

// 2. Verify Stripe Payment
router.post("/verify", verifyPaymentController);

// 3. Get Customer Payment History
router.get("/history", getCustomerPaymentHistoryController);

// 4. Get Payment by Booking ID
router.get("/booking/:bookingId", getPaymentByBookingIdController);

// 5. Get All Payments (Admin)
router.get("/all", getAllPaymentsController);

export default router;