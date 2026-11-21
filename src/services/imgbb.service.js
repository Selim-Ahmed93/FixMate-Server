import { AppError } from "../utils/errors.js";

export const uploadImageToImgBB = async (file) => {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey) {
    throw new AppError("Image upload service is not configured", 503);
  }

  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new AppError("Image file is required", 400);
  }

  const formData = new FormData();
  formData.append("image", file.buffer.toString("base64"));

  let response;

  try {
    response = await fetch(
      `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(20000),
      },
    );
  } catch {
    throw new AppError("Image upload service is unavailable", 502);
  }

  if (!response.ok) {
    throw new AppError("Image upload failed", 502);
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new AppError("Image upload returned an invalid response", 502);
  }

  if (!result?.success || !result?.data?.url) {
    throw new AppError("Image upload failed", 502);
  }

  return result.data.display_url || result.data.url;
};
