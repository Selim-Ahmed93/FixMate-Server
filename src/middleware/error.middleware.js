import multer from "multer";
import { AppError } from "../utils/errors.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error instanceof AppError ? error.statusCode : error.statusCode || 500;
  let message = error.message || "Internal server error";

  if (error instanceof multer.MulterError) {
    statusCode = 400;
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image size must be 5 MB or smaller"
        : "Invalid image upload";
  }

  if (error?.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON request body";
  }

  if (statusCode >= 500) {
    if (process.env.NODE_ENV === "production") {
      console.error("Unhandled server error:", message);
    } else {
      console.error("Unhandled server error:", error);
    }

    if (!(error instanceof AppError)) {
      message = "Internal server error";
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
