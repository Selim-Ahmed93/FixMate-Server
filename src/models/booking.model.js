import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

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

  if (
    !serviceId ||
    !customerEmail ||
    !technicianEmail ||
    !customerName ||
    !address ||
    !preferredDate ||
    !problemDescription ||
    typeof basePrice !== "number" ||
    basePrice <= 0
  ) {
    throw new Error("Invalid booking information");
  }

  if (customerEmail === technicianEmail) {
    throw new Error("Technicians cannot book their own services");
  }

  const newBooking = {
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
    preferredDate: new Date(preferredDate),
    problemDescription,
    status: "requested",
    finalAmount: basePrice,
    paymentStatus: "unpaid",
  };

  return await bookingsCollection().insertOne(newBooking);
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
    .toArray();
};

// 4. Get technician bookings
export const getTechnicianBookings = async (email) => {
  return await bookingsCollection()
    .find({ technicianEmail: email })
    .toArray();
};

// 5. Check existing active booking
export const getActiveBooking = async (serviceId, customerEmail) => {
  return await bookingsCollection().findOne({
    serviceId,
    customerEmail,
    status: {
      $in: ["requested", "accepted", "in-progress"],
    },
  });
};

// 6. Update booking status
// 6. Update booking status
export const updateBookingStatus = async (id, status) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const allowedTransitions = {
    requested: ["accepted", "rejected"],
    accepted: ["in-progress"],
    "in-progress": ["completed"],
  };

  const booking = await getBookingById(id);

  if (!booking) {
    return null;
  }

  const allowedStatuses = allowedTransitions[booking.status] || [];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      `Cannot change booking status from ${booking.status} to ${status}`
    );
  }

  const result = await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      status: booking.status,
    },
    {
      $set: { status },
    }
  );

  if (result.modifiedCount === 0) {
    throw new Error("Booking status was already changed");
  }

  return result;
};

// 7. Update final amount
export const updateFinalAmount = async (id, finalAmount) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  if (typeof finalAmount !== "number" || !Number.isFinite(finalAmount) || finalAmount <= 0) {
    throw new Error("Invalid final amount");
  }

  return await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      status: "in-progress",
    },
    {
      $set: {
        status: "completed",
        finalAmount,
      },
    }
  );
};

// 8. Cancel booking
export const cancelBooking = async (id, customerEmail) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await bookingsCollection().updateOne(
    {
      _id: new ObjectId(id),
      customerEmail,
      status: "requested",
    },
    {
      $set: { status: "cancelled" },
    }
  );
};