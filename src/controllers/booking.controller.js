import {
  createBooking,
  getBookingById,
  getCustomerBookings,
  getTechnicianBookings,
  getAllBookings,
  getActiveBooking,
  updateBookingStatus,
  updateFinalAmount,
  cancelBooking,
  validateBookingStatus,
} from "../models/booking.model.js";

import { getServiceById } from "../models/service.model.js";
import { AppError } from "../utils/errors.js";
import { sendControllerError } from "../utils/controller.js";
import {
  isObjectId,
  requireFutureDate,
  requirePhone,
  requirePositiveNumber,
  requireString,
} from "../utils/validate.js";

// 1. Create a new booking
export const createBookingController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can book services",
      });
    }

    const body = req.body || {};
    const { serviceId } = body;

    if (!isObjectId(serviceId)) {
      throw new AppError("Service ID is invalid", 400);
    }

    const service = await getServiceById(serviceId);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (service.approvalStatus !== "approved" || !service.isAvailable) {
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

    const customerPhone = requirePhone(
      body.customerPhone || req.user.phone,
      "Customer phone",
    );
    const address = requireString(body.address, "Address", {
      min: 5,
      max: 500,
    });
    const preferredDate = requireFutureDate(body.preferredDate);
    const problemDescription = requireString(
      body.problemDescription,
      "Problem description",
      { min: 5, max: 1000 },
    );

    const existingBooking = await getActiveBooking(
      service._id.toString(),
      req.user.email,
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
      preferredDate,
      problemDescription,
    };

    const result = await createBooking(bookingData);

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      bookingId: result.insertedId,
    });
  } catch (error) {
    sendControllerError(res, error);
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
    sendControllerError(res, error);
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
    sendControllerError(res, error);
  }
};

// 4. Get all bookings (Admin)
export const getAllBookingsController = async (req, res) => {
  try {
    const { status, search } = req.query;

    validateBookingStatus(status);

    const bookings = await getAllBookings({
      status,
      search: search
        ? requireString(search, "Search", { max: 100 })
        : undefined,
    });

    res.status(200).json({
      success: true,
      message: "All bookings retrieved successfully",
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 5. Get booking by ID
export const getBookingByIdController = async (req, res) => {
  try {
    if (!isObjectId(req.params.id)) {
      throw new AppError("Booking ID is invalid", 400);
    }

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
    sendControllerError(res, error);
  }
};

// 6. Update booking status
export const updateBookingStatusController = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update booking status",
      });
    }

    if (!isObjectId(req.params.id)) {
      throw new AppError("Booking ID is invalid", 400);
    }

    const status = requireString(req.body?.status, "Booking status", {
      max: 30,
    });

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

    await updateBookingStatus(req.params.id, status);

    const updatedBooking = await getBookingById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 7. Update final amount and complete booking
export const updateFinalAmountController = async (req, res) => {
  try {
    if (req.user?.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update the final amount",
      });
    }

    if (!isObjectId(req.params.id)) {
      throw new AppError("Booking ID is invalid", 400);
    }

    const finalAmount = requirePositiveNumber(
      req.body?.finalAmount,
      "Final amount",
    );

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

    await updateFinalAmount(req.params.id, finalAmount);

    const completedBooking = await getBookingById(req.params.id);

    res.status(200).json({
      success: true,
      message: "Final amount updated and booking completed successfully",
      booking: completedBooking,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 8. Cancel booking
export const cancelBookingController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can cancel bookings",
      });
    }

    if (!isObjectId(req.params.id)) {
      throw new AppError("Booking ID is invalid", 400);
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

    await cancelBooking(req.params.id, req.user.email);

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};
