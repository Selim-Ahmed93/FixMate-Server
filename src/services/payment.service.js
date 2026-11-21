import { ObjectId } from "mongodb";

import { getStripe } from "../config/stripe.js";
import { getFrontendUrl } from "../config/origins.js";
import { getBookingById, markBookingPaid } from "../models/booking.model.js";
import {
  createPayment,
  getPaymentByBookingId,
} from "../models/payment.model.js";
import { AppError } from "../utils/errors.js";
import { requirePositiveNumber } from "../utils/validate.js";

const SUPPORTED_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

const getSessionEmail = (session) => {
  return session.customer_email || session.customer_details?.email || null;
};

const getPaymentIntentId = (session) => {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
};

export const createCheckoutSession = async (booking) => {
  const stripe = getStripe();
  const frontendUrl = getFrontendUrl();
  const amount = requirePositiveNumber(
    booking.finalAmount,
    "Booking final amount",
  );

  const successUrl =
    process.env.PAYMENT_SUCCESS_URL ||
    `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    process.env.PAYMENT_CANCEL_URL || `${frontendUrl}/payment/cancel`;

  try {
    return await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: booking.customerEmail,
      client_reference_id: booking._id.toString(),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: booking.serviceTitle,
              description: `FixMate booking ${booking._id}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
        customerEmail: booking.customerEmail,
        technicianEmail: booking.technicianEmail,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  } catch {
    throw new AppError("Unable to create Stripe checkout session", 502);
  }
};

export const finalizeCheckoutSession = async (session) => {
  if (!session || typeof session !== "object") {
    throw new AppError("Stripe session information is required", 400);
  }

  if (session.payment_status !== "paid") {
    throw new AppError("Payment has not been completed", 400);
  }

  if (session.status && session.status !== "complete") {
    throw new AppError("Stripe checkout session is not complete", 400);
  }

  if (session.mode && session.mode !== "payment") {
    throw new AppError("Invalid Stripe checkout mode", 400);
  }

  const bookingId = session.metadata?.bookingId;

  if (!bookingId || !ObjectId.isValid(bookingId)) {
    throw new AppError("Booking information not found in Stripe session", 400);
  }

  if (
    session.client_reference_id &&
    session.client_reference_id !== bookingId
  ) {
    throw new AppError("Stripe session booking reference does not match", 400);
  }

  const booking = await getBookingById(bookingId);

  if (!booking) {
    throw new AppError("Booking not found", 404);
  }

  const existingPayment = await getPaymentByBookingId(bookingId);

  if (existingPayment) {
    if (existingPayment.stripeSessionId !== session.id) {
      throw new AppError("This booking has already been paid", 409);
    }

    await markBookingPaid(bookingId);

    return {
      payment: existingPayment,
      alreadyProcessed: true,
    };
  }

  if (booking.status !== "completed") {
    throw new AppError("Only completed bookings can be paid", 400);
  }

  if (booking.paymentStatus !== "unpaid") {
    throw new AppError("This booking has already been paid", 409);
  }

  if (session.currency !== "usd") {
    throw new AppError("Payment currency must be USD", 400);
  }

  const expectedAmount = Math.round(booking.finalAmount * 100);

  if (session.amount_total !== expectedAmount) {
    throw new AppError("Payment amount does not match the booking amount", 400);
  }

  const sessionEmail = getSessionEmail(session);

  if (
    !sessionEmail ||
    sessionEmail.toLowerCase() !== booking.customerEmail.toLowerCase()
  ) {
    throw new AppError("Payment customer does not match the booking", 403);
  }

  const transactionId = getPaymentIntentId(session);

  if (!transactionId) {
    throw new AppError("Stripe transaction ID not found", 400);
  }

  let payment;

  try {
    payment = await createPayment({
      bookingId,
      serviceTitle: booking.serviceTitle,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      technicianName: booking.technicianName,
      technicianEmail: booking.technicianEmail,
      amount: booking.finalAmount,
      currency: "usd",
      transactionId,
      stripeSessionId: session.id,
    });
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 409) {
      const racedPayment = await getPaymentByBookingId(bookingId);

      if (racedPayment && racedPayment.stripeSessionId === session.id) {
        await markBookingPaid(bookingId);

        return {
          payment: racedPayment,
          alreadyProcessed: true,
        };
      }
    }

    throw error;
  }

  const updateResult = await markBookingPaid(bookingId);

  if (!updateResult || updateResult.modifiedCount === 0) {
    const refreshedBooking = await getBookingById(bookingId);

    if (refreshedBooking?.paymentStatus !== "paid") {
      await markBookingPaid(bookingId);
    }
  }

  return {
    payment,
    alreadyProcessed: false,
  };
};

export const handleWebhookEvent = async (event) => {
  if (!event || !SUPPORTED_WEBHOOK_EVENTS.has(event.type)) {
    return {
      ignored: true,
      reason: "unsupported_event",
    };
  }

  const session = event.data?.object;

  if (!session) {
    throw new AppError("Stripe event session information is missing", 400);
  }

  if (session.payment_status !== "paid") {
    return {
      ignored: true,
      reason: "payment_not_paid",
    };
  }

  const result = await finalizeCheckoutSession(session);

  return {
    ignored: false,
    ...result,
  };
};
