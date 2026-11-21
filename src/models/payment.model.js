import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { AppError, isDuplicateKeyError } from "../utils/errors.js";
import {
  PAYMENT_STATUSES,
  escapeRegex,
  requireEmail,
  requireObjectId,
  requirePositiveNumber,
  requireString,
} from "../utils/validate.js";

// Payments Collection
const paymentsCollection = () => {
  return getDB().collection("payments");
};

// 1. Create a new verified payment
export const createPayment = async (paymentData) => {
  const {
    bookingId,
    serviceTitle,
    customerName,
    customerEmail,
    technicianName,
    technicianEmail,
    amount,
    currency,
    transactionId,
    stripeSessionId,
  } = paymentData;

  const resolvedBookingId = requireObjectId(bookingId, "Booking ID").toString();

  if (currency !== "usd") {
    throw new AppError("Payment currency must be USD", 400);
  }

  const newPayment = {
    bookingId: resolvedBookingId,
    serviceTitle: requireString(serviceTitle, "Service title", {
      min: 2,
      max: 100,
    }),
    customerName: requireString(customerName, "Customer name", {
      min: 2,
      max: 100,
    }),
    customerEmail: requireEmail(customerEmail, "Customer email"),
    technicianName: requireString(technicianName, "Technician name", {
      min: 2,
      max: 100,
    }),
    technicianEmail: requireEmail(technicianEmail, "Technician email"),
    amount: requirePositiveNumber(amount, "Amount"),
    currency: "usd",
    transactionId: requireString(transactionId, "Transaction ID", {
      max: 200,
    }),
    stripeSessionId: requireString(stripeSessionId, "Stripe session ID", {
      max: 200,
    }),
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  try {
    const result = await paymentsCollection().insertOne(newPayment);

    return {
      ...newPayment,
      _id: result.insertedId,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("A payment already exists for this booking", 409);
    }

    throw error;
  }
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
  if (!ObjectId.isValid(bookingId)) {
    return null;
  }

  return await paymentsCollection().findOne({ bookingId: String(bookingId) });
};

// 4. Get customer payment history
export const getCustomerPayments = async (email) => {
  return await paymentsCollection()
    .find({ customerEmail: email })
    .sort({ paidAt: -1 })
    .toArray();
};

// 5. Get payment by Stripe Session ID
export const getPaymentByStripeSession = async (sessionId) => {
  return await paymentsCollection().findOne({
    stripeSessionId: sessionId,
  });
};

// 6. Get all payments (Admin)
export const getAllPayments = async ({ status, search } = {}) => {
  const query = {};

  if (status !== undefined) {
    query.paymentStatus = status;
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { serviceTitle: pattern },
      { customerName: pattern },
      { customerEmail: pattern },
      { technicianName: pattern },
      { technicianEmail: pattern },
      { transactionId: pattern },
    ];
  }

  return await paymentsCollection()
    .find(query)
    .sort({ paidAt: -1 })
    .toArray();
};

// 7. Validate a payment status query value
export const validatePaymentStatus = (status) => {
  if (status !== undefined && !PAYMENT_STATUSES.includes(status)) {
    throw new AppError(
      `paymentStatus must be one of: ${PAYMENT_STATUSES.join(", ")}`,
      400,
    );
  }

  return status;
};
