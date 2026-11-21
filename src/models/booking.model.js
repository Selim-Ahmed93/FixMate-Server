import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { AppError, isDuplicateKeyError } from "../utils/errors.js";
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  escapeRegex,
  optionalHttpUrl,
  requireEmail,
  requireFutureDate,
  requireObjectId,
  requirePhone,
  requirePositiveNumber,
  requireString,
} from "../utils/validate.js";

// Bookings Collection
const bookingsCollection = () => {
  return getDB().collection("bookings");
};

// 1. Create a new booking
export const createBooking = async (bookingData) => {
  const {
    serviceId,
    serviceTitle,
    serviceImage,
    category,
    basePrice,
    technicianName,
    technicianEmail,
    customerName,
    customerEmail,
    customerPhone,
    address,
    preferredDate,
    problemDescription,
  } = bookingData;

  const resolvedServiceId = requireObjectId(serviceId, "Service ID").toString();

  const newBooking = {
    serviceId: resolvedServiceId,
    serviceTitle: requireString(serviceTitle, "Service title", {
      min: 2,
      max: 100,
    }),
    serviceImage: optionalHttpUrl(serviceImage, "Service image") || null,
    category: requireString(category, "Category", { min: 2, max: 60 }),
    basePrice: requirePositiveNumber(basePrice, "Base price"),
    technicianName: requireString(technicianName, "Technician name", {
      min: 2,
      max: 100,
    }),
    technicianEmail: requireEmail(technicianEmail, "Technician email"),
    customerName: requireString(customerName, "Customer name", {
      min: 2,
      max: 100,
    }),
    customerEmail: requireEmail(customerEmail, "Customer email"),
    customerPhone: requirePhone(customerPhone, "Customer phone"),
    address: requireString(address, "Address", { min: 5, max: 500 }),
    preferredDate: requireFutureDate(preferredDate),
    problemDescription: requireString(
      problemDescription,
      "Problem description",
      { min: 5, max: 1000 },
    ),
    status: "requested",
    finalAmount: requirePositiveNumber(basePrice, "Base price"),
    paymentStatus: "unpaid",
  };

  // Prevent technicians from booking their own services
  if (newBooking.customerEmail === newBooking.technicianEmail) {
    throw new AppError("Technicians cannot book their own services", 403);
  }

  try {
    return await bookingsCollection().insertOne(newBooking);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        "You already have an active booking for this service",
        409,
      );
    }

    throw error;
  }
};

// 2. Get booking by ID
export const getBookingById = async (id) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await bookingsCollection().findOne({
    _id: new ObjectId(id),
  });
};

// 3. Get customer bookings
export const getCustomerBookings = async (email) => {
  return await bookingsCollection()
    .find({ customerEmail: email })
    .sort({ _id: -1 })
    .toArray();
};

// 4. Get technician bookings
export const getTechnicianBookings = async (email) => {
  return await bookingsCollection()
    .find({ technicianEmail: email })
    .sort({ _id: -1 })
    .toArray();
};

// 5. Get all bookings for admin
export const getAllBookings = async ({ status, search } = {}) => {
  const query = {};

  if (status !== undefined) {
    query.status = status;
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { serviceTitle: pattern },
      { customerName: pattern },
      { customerEmail: pattern },
      { technicianName: pattern },
      { technicianEmail: pattern },
    ];
  }

  return await bookingsCollection()
    .find(query)
    .sort({ _id: -1 })
    .toArray();
};

// 6. Check existing active booking
export const getActiveBooking = async (serviceId, customerEmail) => {
  return await bookingsCollection().findOne({
    serviceId,
    customerEmail,
    status: {
      $in: ACTIVE_BOOKING_STATUSES,
    },
  });
};

// 7. Update booking status
export const updateBookingStatus = async (id, status) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  if (!BOOKING_STATUSES.includes(status)) {
    throw new AppError("Invalid booking status", 400);
  }

  const allowedTransitions = {
    requested: ["accepted", "rejected"],
    accepted: ["in-progress"],
    "in-progress": [],
    completed: [],
    rejected: [],
    cancelled: [],
  };

  const booking = await getBookingById(id);

  if (!booking) {
    return null;
  }

  const allowedStatuses = allowedTransitions[booking.status] || [];

  if (!allowedStatuses.includes(status)) {
    throw new AppError(
      `Cannot change booking status from ${booking.status} to ${status}`,
      400,
    );
  }

  const result = await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      status: booking.status,
    },
    {
      $set: { status },
    },
  );

  if (result.modifiedCount === 0) {
    throw new AppError("Booking status was already changed", 409);
  }

  return result;
};

// 8. Update final amount and complete booking
export const updateFinalAmount = async (id, finalAmount) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const amount = requirePositiveNumber(finalAmount, "Final amount");

  const result = await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      status: "in-progress",
    },
    {
      $set: {
        status: "completed",
        finalAmount: amount,
      },
    },
  );

  if (result.modifiedCount === 0) {
    throw new AppError("Only in-progress bookings can be completed", 409);
  }

  return result;
};

// 9. Cancel booking
export const cancelBooking = async (id, customerEmail) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  if (!customerEmail) {
    throw new AppError("Customer email is required", 400);
  }

  const result = await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      customerEmail,
      status: "requested",
    },
    {
      $set: { status: "cancelled" },
    },
  );

  if (result.modifiedCount === 0) {
    throw new AppError("Only requested bookings can be cancelled", 409);
  }

  return result;
};

// 10. Mark a booking as paid
export const markBookingPaid = async (id) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      paymentStatus: "unpaid",
    },
    {
      $set: { paymentStatus: "paid" },
    },
  );
};

// 11. Validate a booking status query value
export const validateBookingStatus = (status) => {
  if (status !== undefined && !BOOKING_STATUSES.includes(status)) {
    throw new AppError(
      `status must be one of: ${BOOKING_STATUSES.join(", ")}`,
      400,
    );
  }

  return status;
};
