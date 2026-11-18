import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Services Collection
const servicesCollection = () => {
  return getDB().collection("services");
};

// 1. Create a new service
export const createService = async (serviceData) => {
  const {
    title,
    category,
    description,
    image,
    basePrice,
    estimatedDuration,
    serviceMode,
    serviceArea,
    technicianName,
    technicianEmail,
  } = serviceData;

  if (
    !title ||
    !category ||
    !description ||
    !technicianName ||
    !technicianEmail ||
    typeof basePrice !== "number" ||
    !Number.isFinite(basePrice) ||
    basePrice <= 0
  ) {
    throw new Error("Invalid service information");
  }

  const newService = {
    title,
    category,
    description,
    image,
    basePrice,
    estimatedDuration,
    serviceMode,
    serviceArea,
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
    .toArray();
};

// 5. Update service information
export const updateService = async (id, updateData) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const allowedFields = [
    "title",
    "category",
    "description",
    "image",
    "basePrice",
    "estimatedDuration",
    "serviceMode",
    "serviceArea",
    "isAvailable",
  ];

  const filteredData = {};

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      filteredData[field] = updateData[field];
    }
  }

  if (
  filteredData.basePrice !== undefined &&
  (
    typeof filteredData.basePrice !== "number" ||
    !Number.isFinite(filteredData.basePrice) ||
    filteredData.basePrice <= 0
  )
) {
  throw new Error("Invalid service price");
}

  if (Object.keys(filteredData).length === 0) {
    throw new Error("No valid fields provided for update");
  }

  return await servicesCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: filteredData,
    }
  );
};

// 6. Update service approval status
// 6. Update service approval status
export const updateServiceApproval = async (id, status) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const allowedStatuses = ["approved", "rejected"];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid approval status");
  }

  return await servicesCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { approvalStatus: status },
    }
  );
};