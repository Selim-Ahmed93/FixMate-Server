import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { AppError } from "../utils/errors.js";
import {
  ROLES,
  escapeRegex,
  optionalHttpUrl,
  optionalString,
  requireEmail,
  requirePhone,
  requireString,
} from "../utils/validate.js";

const usersCollection = () => {
  return getDB().collection("user");
};

export const getUserById = async (id) => {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return await usersCollection().findOne({ _id: new ObjectId(id) });
};

export const getUserByEmail = async (email) => {
  if (!email) {
    return null;
  }

  return await usersCollection().findOne({
    email: String(email).toLowerCase(),
  });
};

export const getUserByIdOrEmail = async ({ id, email }) => {
  if (id && ObjectId.isValid(id)) {
    const user = await getUserById(id);

    if (user) {
      return user;
    }
  }

  return await getUserByEmail(email);
};

export const getUsers = async ({ role, search } = {}) => {
  const query = {};

  if (role !== undefined) {
    query.role = role;
  }

  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    query.$or = [{ name: pattern }, { email: pattern }];
  }

  return await usersCollection()
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
};

export const countUsersByRole = async (role) => {
  return await usersCollection().countDocuments({ role });
};

export const countAdmins = async () => {
  return await usersCollection().countDocuments({ role: "admin" });
};

export const updateUserRole = async (id, role) => {
  if (!ObjectId.isValid(id)) {
    throw new AppError("User ID is invalid", 400);
  }

  if (!ROLES.includes(role)) {
    throw new AppError(`role must be one of: ${ROLES.join(", ")}`, 400);
  }

  return await usersCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        role,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );
};

export const updateUserProfile = async (id, data) => {
  if (!ObjectId.isValid(id)) {
    throw new AppError("User ID is invalid", 400);
  }

  const updates = {};

  if (data.name !== undefined) {
    updates.name = requireString(data.name, "Name", { min: 2, max: 100 });
  }

  if (data.phone !== undefined) {
    updates.phone = requirePhone(data.phone, "Phone");
  }

  if (data.area !== undefined) {
    updates.area = requireString(data.area, "Area", { min: 1, max: 100 });
  }

  if (data.bio !== undefined) {
    updates.bio = optionalString(data.bio, "Bio", {
      max: 500,
      allowEmpty: true,
    });
  }

  if (data.image !== undefined) {
    updates.image =
      data.image === null || data.image === ""
        ? null
        : optionalHttpUrl(data.image, "Profile image");
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError("No valid profile fields provided for update", 400);
  }

  updates.updatedAt = new Date();

  return await usersCollection().findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: "after" },
  );
};

export const validateUserRole = (role) => {
  if (role !== undefined && !ROLES.includes(role)) {
    throw new AppError(`role must be one of: ${ROLES.join(", ")}`, 400);
  }

  return role;
};

export const validateUserEmail = (email) => {
  return requireEmail(email, "Email");
};
