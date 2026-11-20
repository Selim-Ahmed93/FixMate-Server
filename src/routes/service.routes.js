import express from "express";

import {
  createServiceController,
  getApprovedServicesController,
  getServiceByIdController,
  getTechnicianServicesController,
  updateServiceController,
  updateServiceApprovalController,
} from "../controllers/service.controller.js";

const router = express.Router();

// 1. Create a new service
router.post("/", createServiceController);

// 2. Get all approved and available services
router.get("/", getApprovedServicesController);

// 3. Get technician's services
router.get("/technician", getTechnicianServicesController);

// 4. Get a service by ID
router.get("/:id", getServiceByIdController);

// 5. Update service information
router.patch("/:id", updateServiceController);

// 6. Update service approval status
router.patch("/:id/approval", updateServiceApprovalController);

export default router;