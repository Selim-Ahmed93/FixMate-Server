export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export const isDuplicateKeyError = (error) => {
  return Boolean(error && error.code === 11000);
};
