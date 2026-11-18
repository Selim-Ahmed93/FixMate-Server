import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Payments Collection
const paymentsCollection = () => {
  return getDB().collection("payments");
};

// 1. Create a new payment
export const createPayment = async (paymentData) => {
  const {
    bookingId,
    serviceTitle,
    customerName,
    customerEmail,
    technicianName,
    technicianEmail,
    amount,
    transactionId,
    stripeSessionId,
    stripePaymentVerified,
  } = paymentData;

  // Stripe verification check
  if (stripePaymentVerified !== true) {
    throw new Error("Stripe payment is not verified");
  }

  // Required fields validation
  if (
    !bookingId ||
    !transactionId ||
    !stripeSessionId ||
    typeof amount !== "number" ||
    amount <= 0
  ) {
    throw new Error("Invalid payment information");
  }

  const bookingsCollection = getDB().collection("bookings");

  // Check booking eligibility
  const booking = await bookingsCollection.findOne({
    _id: new ObjectId(bookingId),
    status: "completed",
    paymentStatus: "unpaid",
  });

  if (!booking) {
    throw new Error("Booking is not eligible for payment");
  }

  // Check existing payment
  const existingPayment = await paymentsCollection().findOne({
    bookingId,
  });

  if (existingPayment) {
    throw new Error("Payment already exists for this booking");
  }

  // Verify amount against booking
  if (amount !== booking.finalAmount) {
    throw new Error("Payment amount does not match booking amount");
  }

  const newPayment = {
    bookingId,
    serviceTitle,
    customerName,
    customerEmail,
    technicianName,
    technicianEmail,
    amount,
    currency: "usd",
    transactionId,
    stripeSessionId,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  const result = await paymentsCollection().insertOne(newPayment);

  // Update booking payment status
  await bookingsCollection.updateOne(
    {
      _id: new ObjectId(bookingId),
      status: "completed",
      paymentStatus: "unpaid",
    },
    {
      $set: { paymentStatus: "paid" },
    }
  );

  return result;
};

// 2. Get payment by ID
export const getPaymentById = async (id) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await paymentsCollection().findOne({
    _id: new ObjectId(id),
  });
};

// 3. Get payment by booking ID
export const getPaymentByBookingId = async (bookingId) => {
  return await paymentsCollection().findOne({ bookingId });
};

// 4. Get customer payment history
export const getCustomerPayments = async (email) => {
  return await paymentsCollection()
    .find({ customerEmail: email })
    .sort({ paidAt: -1 })
    .toArray();
};

// 5. Check existing payment by Stripe Session ID
export const getPaymentByStripeSession = async (sessionId) => {
  return await paymentsCollection().findOne({
    stripeSessionId: sessionId,
  });
};

// 6. Get all payments (Admin)
export const getAllPayments = async () => {
  return await paymentsCollection()
    .find()
    .sort({ paidAt: -1 })
    .toArray();
};