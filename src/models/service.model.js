import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import {
  APPROVAL_STATUSES,
  escapeRegex,
  optionalHttpUrl,
  requireBoolean,
  requireEmail,
  requireObjectId,
  requirePositiveNumber,
  requireString,
} from "../utils/validate.js";

// Services Collection
const servicesCollection = () => {
  return getDB().collection("services");
};

const validateServiceFields = (data, { partial = false } = {}) => {
  const result = {};

  const setString = (field, options) => {
    if (data[field] === undefined) {
      if (!partial) {
        throw new AppError(`${field} is required`, 400);
      }
      return;
    }

    result[field] = requireString(data[field], field, options);
  };

  setString("title", { min: 3, max: 100 });
  setString("category", { min: 2, max: 60 });
  setString("description", { min: 10, max: 2000 });
  setString("estimatedDuration", { min: 1, max: 100 });
  setString("serviceMode", { min: 1, max: 50 });
  setString("serviceArea", { min: 1, max: 100 });

  if (data.basePrice !== undefined) {
    result.basePrice = requirePositiveNumber(data.basePrice, "Base price");
  } else if (!partial) {
    throw new AppError("Base price is required", 400);
  }

  if (data.image !== undefined) {
    result.image =
      data.image === null || data.image === ""
        ? null
        : optionalHttpUrl(data.image, "Service image");
  }

  if (data.isAvailable !== undefined) {
    result.isAvailable = requireBoolean(data.isAvailable, "isAvailable");
  }

  return result;
};

// 1. Create a new service
export const createService = async (serviceData) => {
  const fields = validateServiceFields(serviceData);

  const technicianName = requireString(
    serviceData.technicianName,
    "Technician name",
    { min: 2, max: 100 },
  );
  const technicianEmail = requireEmail(
    serviceData.technicianEmail,
    "Technician email",
  );

  const newService = {
    ...fields,
    image: fields.image ?? null,
    technicianName,
    technicianEmail,
    approvalStatus: "pending",
    isAvailable: true,
    createdAt: new Date(),
  };

  return await servicesCollection().insertOne(newService);
};

// 2. Get all approved and available services
export const getApprovedServices = async () => {
  return await servicesCollection()
    .find({
      approvalStatus: "approved",
      isAvailable: true,
    })
    .sort({ createdAt: -1 })
    .toArray();
};

// 3. Get a service by ID
export const getServiceById = async (id) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await servicesCollection().findOne({
    _id: new ObjectId(id),
  });
};

// 4. Get services by technician email
export const getTechnicianServices = async (email) => {
  return await servicesCollection()
    .find({ technicianEmail: email })
    .sort({ createdAt: -1 })
    .toArray();
};

// 5. Get all services for admin
export const getAllServices = async ({ status, search, available } = {}) => {
  const query = {};

  if (status !== undefined) {
    query.approvalStatus = status;
  }

  if (available !== undefined) {
    query.isAvailable = available;
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { title: pattern },
      { category: pattern },
      { technicianName: pattern },
      { technicianEmail: pattern },
    ];
  }

  return await servicesCollection()
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
};

// 6. Update service information
export const updateService = async (id, updateData) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const filteredData = validateServiceFields(updateData, { partial: true });

  if (Object.keys(filteredData).length === 0) {
    throw new AppError("No valid fields provided for update", 400);
  }

  return await servicesCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...filteredData,
        approvalStatus: "pending",
      },
    },
  );
};

// 7. Update service approval status
export const updateServiceApproval = async (id, status) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  if (!["approved", "rejected"].includes(status)) {
    throw new AppError("Invalid approval status", 400);
  }

  return await servicesCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { approvalStatus: status },
    },
  );
};

// 8. Delete a service (only its owner technician)
export const deleteService = async (id, technicianEmail) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  if (!technicianEmail) {
    throw new AppError("Technician email is required", 400);
  }

  return await servicesCollection().deleteOne({
    _id: new ObjectId(id),
    technicianEmail,
  });
};

// 9. Validate an approval status query value
export const validateApprovalStatus = (status) => {
  if (status !== undefined && !APPROVAL_STATUSES.includes(status)) {
    throw new AppError(
      `approvalStatus must be one of: ${APPROVAL_STATUSES.join(", ")}`,
      400,
    );
  }

  return status;
};

// 10. Resolve a service id or throw a 400 error
export const resolveServiceId = (id) => {
  return requireObjectId(id, "Service ID");
};
