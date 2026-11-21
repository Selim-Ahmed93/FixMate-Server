import { getStripe } from "../config/stripe.js";
import { getBookingById } from "../models/booking.model.js";
import {
  getPaymentByBookingId,
  getCustomerPayments,
  getAllPayments,
  validatePaymentStatus,
} from "../models/payment.model.js";
import {
  createCheckoutSession,
  finalizeCheckoutSession,
  handleWebhookEvent,
} from "../services/payment.service.js";
import { AppError } from "../utils/errors.js";
import { sendControllerError } from "../utils/controller.js";
import { isObjectId, requireString } from "../utils/validate.js";

// 1. Create Stripe Checkout Session
export const createCheckoutSessionController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can make payments",
      });
    }

    const bookingId = req.body?.bookingId;

    if (!isObjectId(bookingId)) {
      throw new AppError("Booking ID is invalid", 400);
    }

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this booking",
      });
    }

    if (
      booking.status !== "completed" ||
      booking.paymentStatus !== "unpaid"
    ) {
      return res.status(400).json({
        success: false,
        message: "This booking is not eligible for payment",
      });
    }

    const existingPayment = await getPaymentByBookingId(bookingId);

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "Payment already exists for this booking",
      });
    }

    const session = await createCheckoutSession(booking);

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      bookingId,
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 2. Verify Stripe Payment
export const verifyPaymentController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can verify payments",
      });
    }

    const sessionId = requireString(req.body?.sessionId, "Stripe session ID", {
      max: 200,
    });

    const stripe = getStripe();

    let session;

    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      if (error?.code === "resource_missing") {
        throw new AppError("Stripe checkout session not found", 404);
      }

      throw new AppError("Unable to retrieve Stripe checkout session", 502);
    }

    const bookingId = session.metadata?.bookingId;

    if (!isObjectId(bookingId)) {
      throw new AppError("Booking information not found in Stripe session", 400);
    }

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to verify this payment",
      });
    }

    const result = await finalizeCheckoutSession(session);

    res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? "Payment has already been verified"
        : "Payment verified and saved successfully",
      alreadyProcessed: result.alreadyProcessed,
      paymentId: result.payment._id,
      payment: result.payment,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 3. Stripe Webhook
export const stripeWebhookController = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({
      success: false,
      message: "Stripe signature is missing",
    });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({
      success: false,
      message: "Stripe webhook is not configured",
    });
  }

  let event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature",
    });
  }

  try {
    const result = await handleWebhookEvent(event);

    return res.status(200).json({
      received: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode < 500) {
      return res.status(200).json({
        received: true,
        ignored: true,
        message: error.message,
      });
    }

    console.error(
      "Stripe webhook processing failed:",
      event?.type || "unknown",
      event?.id || "unknown",
    );

    return res.status(500).json({
      received: false,
      message: "Stripe webhook processing failed",
    });
  }
};

// 4. Get Customer Payment History
export const getCustomerPaymentHistoryController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can access payment history",
      });
    }

    const payments = await getCustomerPayments(req.user.email);

    res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      totalPayments: payments.length,
      payments,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 5. Get Payment by Booking ID
export const getPaymentByBookingIdController = async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!isObjectId(bookingId)) {
      throw new AppError("Booking ID is invalid", 400);
    }

    const payment = await getPaymentByBookingId(bookingId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const isCustomer =
      req.user?.role === "customer" &&
      booking.customerEmail === req.user.email;

    const isTechnician =
      req.user?.role === "technician" &&
      booking.technicianEmail === req.user.email;

    const isAdmin = req.user?.role === "admin";

    if (!isCustomer && !isTechnician && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this payment",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment retrieved successfully",
      payment,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 6. Get All Payments (Admin)
export const getAllPaymentsController = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can access all payments",
      });
    }

    const { status, search } = req.query;

    validatePaymentStatus(status);

    const payments = await getAllPayments({
      status,
      search: search
        ? requireString(search, "Search", { max: 100 })
        : undefined,
    });

    res.status(200).json({
      success: true,
      message: "All payments retrieved successfully",
      totalPayments: payments.length,
      payments,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};
