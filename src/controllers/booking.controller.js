
import {
  createBooking,
  getBookingById,
  getCustomerBookings,
  getTechnicianBookings,
  getActiveBooking,
  updateBookingStatus,
  updateFinalAmount,
  cancelBooking,
} from "../models/booking.model.js";

import { getServiceById } from "../models/service.model.js";

// 1. Create a new booking
export const createBookingController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can book services",
      });
    }

    const {
      serviceId,
      customerPhone,
      address,
      preferredDate,
      problemDescription,
    } = req.body;

    const service = await getServiceById(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (
      service.approvalStatus !== "approved" ||
      !service.isAvailable
    ) {
      return res.status(400).json({
        success: false,
        message: "This service is not available",
      });
    }

    if (service.technicianEmail === req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You cannot book your own service",
      });
    }

    const bookingDate = new Date(preferredDate);

    if (
      !customerPhone ||
      !address ||
      !preferredDate ||
      Number.isNaN(bookingDate.getTime()) ||
      bookingDate <= new Date() ||
      !problemDescription
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide valid booking information",
      });
    }

    const existingBooking = await getActiveBooking(
      serviceId,
      req.user.email
    );

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an active booking for this service",
      });
    }

    const bookingData = {
      serviceId: service._id.toString(),
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone,
      address,
      preferredDate: bookingDate,
      problemDescription,
    };

    const result = await createBooking(bookingData);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      bookingId: result.insertedId,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 2. Get customer's bookings
export const getCustomerBookingsController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can access their bookings",
      });
    }

    const bookings = await getCustomerBookings(req.user.email);

    res.status(200).json({
      success: true,
      message: "Customer bookings retrieved successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 3. Get technician's bookings
export const getTechnicianBookingsController = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can access their bookings",
      });
    }

    const bookings = await getTechnicianBookings(req.user.email);

    res.status(200).json({
      success: true,
      message: "Technician bookings retrieved successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 4. Get booking by ID
export const getBookingByIdController = async (req, res) => {
  try {
    const booking = await getBookingById(req.params.id);

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
        message: "You are not authorized to view this booking",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully",
      booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 5. Update booking status
export const updateBookingStatusController = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update booking status",
      });
    }

    const { status } = req.body;

    const booking = await getBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this booking",
      });
    }

    const result = await updateBookingStatus(
      req.params.id,
      status
    );

    if (!result || result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Booking status could not be updated",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 6. Update final amount
export const updateFinalAmountController = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update the final amount",
      });
    }

    const { finalAmount } = req.body;

    if (
      typeof finalAmount !== "number" ||
      !Number.isFinite(finalAmount) ||
      finalAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid final amount",
      });
    }

    const booking = await getBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this booking",
      });
    }

    if (booking.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        message: "Only in-progress bookings can be completed",
      });
    }

    const result = await updateFinalAmount(
      req.params.id,
      finalAmount
    );

    if (!result || result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Final amount could not be updated",
      });
    }

    res.status(200).json({
      success: true,
      message: "Final amount updated and booking completed successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
// 7. Cancel booking
export const cancelBookingController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can cancel bookings",
      });
    }

    const booking = await getBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking",
      });
    }

    if (booking.status !== "requested") {
      return res.status(400).json({
        success: false,
        message: "Only requested bookings can be cancelled",
      });
    }

    const result = await cancelBooking(
      req.params.id,
      req.user.email
    );

    if (!result || result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Booking could not be cancelled",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};