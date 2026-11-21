import { ObjectId } from "mongodb";
import { AppError } from "./errors.js";

export const ROLES = Object.freeze(["customer", "technician", "admin"]);
export const SIGNUP_ROLES = Object.freeze(["customer", "technician"]);

export const APPROVAL_STATUSES = Object.freeze([
  "pending",
  "approved",
  "rejected",
]);

export const BOOKING_STATUSES = Object.freeze([
  "requested",
  "accepted",
  "rejected",
  "in-progress",
  "completed",
  "cancelled",
]);

export const ACTIVE_BOOKING_STATUSES = Object.freeze([
  "requested",
  "accepted",
  "in-progress",
]);

export const PAYMENT_STATUSES = Object.freeze(["unpaid", "paid"]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+]?[\d\s().-]{7,25}$/;

export const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

export const requireString = (value, field, options = {}) => {
  const { min = 1, max = 500, allowEmpty = false } = options;

  if (value === undefined || value === null) {
    throw new AppError(`${field} is required`, 400);
  }

  if (typeof value !== "string") {
    throw new AppError(`${field} must be a string`, 400);
  }

  const trimmed = value.trim();

  if (!allowEmpty && trimmed.length < min) {
    throw new AppError(`${field} must be at least ${min} characters`, 400);
  }

  if (trimmed.length > max) {
    throw new AppError(`${field} must be at most ${max} characters`, 400);
  }

  return trimmed;
};

export const optionalString = (value, field, options = {}) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireString(value, field, options);
};

export const requireEmail = (value, field = "Email") => {
  const email = requireString(value, field, { max: 254 }).toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new AppError(`${field} is invalid`, 400);
  }

  return email;
};

export const requirePhone = (value, field = "Phone") => {
  const phone = requireString(value, field, { min: 7, max: 25 });

  if (!PHONE_PATTERN.test(phone)) {
    throw new AppError(`${field} is invalid`, 400);
  }

  return phone;
};

export const requirePositiveNumber = (value, field) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new AppError(`${field} must be a positive number`, 400);
  }

  return value;
};

export const optionalPositiveNumber = (value, field) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requirePositiveNumber(value, field);
};

export const requireBoolean = (value, field) => {
  if (typeof value !== "boolean") {
    throw new AppError(`${field} must be a boolean`, 400);
  }

  return value;
};

export const requireFutureDate = (value, field = "Preferred date") => {
  if (value === undefined || value === null || value === "") {
    throw new AppError(`${field} is required`, 400);
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} is invalid`, 400);
  }

  if (date.getTime() <= Date.now()) {
    throw new AppError(`${field} must be in the future`, 400);
  }

  return date;
};

export const requireObjectId = (value, field = "ID") => {
  if (!ObjectId.isValid(value)) {
    throw new AppError(`${field} is invalid`, 400);
  }

  return new ObjectId(value);
};

export const isObjectId = (value) => ObjectId.isValid(value);

export const requireEnum = (value, allowedValues, field) => {
  if (!allowedValues.includes(value)) {
    throw new AppError(
      `${field} must be one of: ${allowedValues.join(", ")}`,
      400,
    );
  }

  return value;
};

export const optionalHttpUrl = (value, field = "Image URL") => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const url = requireString(value, field, { max: 2048 });

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    throw new AppError(`${field} must be a valid HTTP or HTTPS URL`, 400);
  }

  return url;
};

export const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const normalizeRole = (role) => {
  return SIGNUP_ROLES.includes(role) ? role : "customer";
};
