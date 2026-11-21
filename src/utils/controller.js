import { AppError } from "./errors.js";

export const sendControllerError = (res, error) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const isKnownError = error instanceof AppError;

  if (statusCode >= 500 && !isKnownError) {
    console.error("Controller error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: isKnownError ? error.message : "Internal server error",
  });
};
