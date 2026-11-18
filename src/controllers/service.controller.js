import {
  createService,
  getApprovedServices,
  getServiceById,
  getTechnicianServices,
  updateService,
  updateServiceApproval,
} from "../models/service.model.js";

// 1. Create a new service
export const createServiceController = async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can create services",
      });
    }

    const serviceData = {
      ...req.body,
      technicianName: req.user.name,
      technicianEmail: req.user.email,
    };

    const result = await createService(serviceData);

    res.status(201).json({
      success: true,
      message: "Service created successfully",
      serviceId: result.insertedId,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// 3. Get a service by ID
export const getServiceByIdController = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await getServiceById(id);

    if (!service) {
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
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
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 5. Update service information
export const updateServiceController = async (req, res) => {
  try {
    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update services",
      });
    }

    const { id } = req.params;

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

    const result = await updateService(id, req.body);

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Service updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
// 6. Update service approval status
export const updateServiceApprovalController = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can approve or reject services",
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    const service = await getServiceById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const result = await updateServiceApproval(id, status);

    if (result.modifiedCount === 0) {
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
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};