import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Services Collection
const servicesCollection = () => {
  return getDB().collection("services");
};

// 1. Create a new service
export const createService = async (serviceData) => {
  const newService = {
    ...serviceData,
    approvalStatus: "pending",
    isAvailable: true,
    createdAt: new Date(),
  };

  const result = await servicesCollection().insertOne(newService);

  return result;
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

  const result = await servicesCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: updateData,
    }
  );

  return result;
};

// 6. Update service approval status
export const updateServiceApproval = async (id, status) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await servicesCollection().updateOne(
    { _id: new ObjectId(id) },
    {
      $set: { approvalStatus: status },
    }
  );
};