import express from "express";

import {
  createServiceController,
  getApprovedServicesController,
  getServiceByIdController,
  getTechnicianServicesController,
  updateServiceController,
  updateServiceApprovalController,
} from "../controllers/service.controller.js";

import {
  authenticate,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();

// 1. Create a new service (Technician)
router.post(
  "/",
  authenticate,
  authorizeRoles("technician"),
  createServiceController
);

// 2. Get all approved and available services (Public)
router.get("/", getApprovedServicesController);

// 3. Get technician's services (Technician)
router.get(
  "/technician",
  authenticate,
  authorizeRoles("technician"),
  getTechnicianServicesController
);

// 4. Get a service by ID (Public)
router.get("/:id", getServiceByIdController);

// 5. Update service information (Technician)
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("technician"),
  updateServiceController
);

// 6. Update service approval status (Admin)
router.patch(
  "/:id/approval",
  authenticate,
  authorizeRoles("admin"),
  updateServiceApprovalController
);

export default router;