import multer from "multer";
import { AppError } from "../utils/errors.js";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const uploadProfileImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return callback(
        new AppError("Only JPEG, PNG, WebP, or GIF images are allowed", 400),
      );
    }

    callback(null, true);
  },
}).single("image");
