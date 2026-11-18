import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Bookings Collection
const bookingsCollection = () => {
  return getDB().collection("bookings");
};

// 1. Create a new booking
export const createBooking = async (bookingData) => {
  const newBooking = {
    ...bookingData,
    status: "requested",
    finalAmount: bookingData.basePrice,
    paymentStatus: "unpaid",
  };

  const result = await bookingsCollection().insertOne(newBooking);

  return result;
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
export const updateBookingStatus = async (id, status) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await bookingsCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { status },
    }
  );
};

// 7. Update final amount
export const updateFinalAmount = async (id, finalAmount) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await bookingsCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { finalAmount },
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