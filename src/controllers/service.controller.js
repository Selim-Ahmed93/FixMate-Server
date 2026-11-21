import {
  createService,
  getApprovedServices,
  getServiceById,
  getTechnicianServices,
  getAllServices,
  updateService,
  updateServiceApproval,
  deleteService,
  validateApprovalStatus,
} from "../models/service.model.js";

import { AppError } from "../utils/errors.js";
import { sendControllerError } from "../utils/controller.js";
import { isObjectId, requireString } from "../utils/validate.js";

// 1. Create a new service
export const createServiceController = async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can create services",
      });
    }

    const body = req.body || {};

    const serviceData = {
      title: body.title,
      category: body.category,
      description: body.description,
      image: body.image,
      basePrice: body.basePrice,
      estimatedDuration: body.estimatedDuration,
      serviceMode: body.serviceMode,
      serviceArea: body.serviceArea,
      technicianName: req.user.name,
      technicianEmail: req.user.email,
    };

    const result = await createService(serviceData);

    res.status(201).json({
      success: true,
      message: "Service created successfully. Admin approval is required.",
      serviceId: result.insertedId,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 2. Get all approved and available services
export const getApprovedServicesController = async (req, res) => {
  try {
    const services = await getApprovedServices();

    res.status(200).json({
      success: true,
      message: "Services retrieved successfully",
      totalServices: services.length,
      services,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 3. Get an approved and available service by ID (Public)
export const getServiceByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isObjectId(id)) {
      throw new AppError("Service ID is invalid", 400);
    }

    const service = await getServiceById(id);

    if (
      !service ||
      service.approvalStatus !== "approved" ||
      service.isAvailable !== true
    ) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service retrieved successfully",
      service,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 4. Get technician's services
export const getTechnicianServicesController = async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can access their services",
      });
    }

    const services = await getTechnicianServices(req.user.email);

    res.status(200).json({
      success: true,
      message: "Technician services retrieved successfully",
      totalServices: services.length,
      services,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 5. Get all services (Admin)
export const getAllServicesController = async (req, res) => {
  try {
    const { status, search } = req.query;

    validateApprovalStatus(status);

    let available;

    if (req.query.available !== undefined) {
      if (!["true", "false"].includes(req.query.available)) {
        throw new AppError("available must be true or false", 400);
      }

      available = req.query.available === "true";
    }

    const services = await getAllServices({
      status,
      search: search
        ? requireString(search, "Search", { max: 100 })
        : undefined,
      available,
    });

    res.status(200).json({
      success: true,
      message: "All services retrieved successfully",
      totalServices: services.length,
      services,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 6. Update service information
export const updateServiceController = async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update services",
      });
    }

    const { id } = req.params;

    if (!isObjectId(id)) {
      throw new AppError("Service ID is invalid", 400);
    }

    const service = await getServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Verify service ownership
    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You cannot update another technician's service",
      });
    }

    const result = await updateService(id, req.body || {});

    if (!result || result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const updatedService = await getServiceById(id);

    res.status(200).json({
      success: true,
      message: "Service updated successfully. Admin approval is required again.",
      service: updatedService,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

const setServiceApproval = async (req, res, status) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can approve or reject services",
      });
    }

    const { id } = req.params;

    if (!isObjectId(id)) {
      throw new AppError("Service ID is invalid", 400);
    }

    if (!["approved", "rejected"].includes(status)) {
      throw new AppError("Invalid approval status", 400);
    }

    const service = await getServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (service.approvalStatus === status) {
      return res.status(200).json({
        success: true,
        message: `Service is already ${status}`,
      });
    }

    const result = await updateServiceApproval(id, status);

    if (!result || result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Service approval status was not changed",
      });
    }

    res.status(200).json({
      success: true,
      message: `Service ${status} successfully`,
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};

// 7. Update service approval status (Admin, generic route)
export const updateServiceApprovalController = async (req, res) => {
  return setServiceApproval(req, res, req.body?.status);
};

// 8. Approve service (Admin)
export const approveServiceController = async (req, res) => {
  return setServiceApproval(req, res, "approved");
};

// 9. Reject service (Admin)
export const rejectServiceController = async (req, res) => {
  return setServiceApproval(req, res, "rejected");
};

// 10. Delete technician's own service
export const deleteServiceController = async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can delete services",
      });
    }

    const { id } = req.params;

    if (!isObjectId(id)) {
      throw new AppError("Service ID is invalid", 400);
    }

    const service = await getServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Verify service ownership
    if (service.technicianEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete another technician's service",
      });
    }

    const result = await deleteService(id, req.user.email);

    if (!result || result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Service could not be deleted",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    sendControllerError(res, error);
  }
};
