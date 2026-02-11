import { AppError } from "../utils/errors.js";

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, "ROUTE_NOT_FOUND"));
}

export function errorHandler(error, _req, res, _next) {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const message =
    statusCode >= 500 ? "An unexpected server error occurred." : error.message || "Request failed.";

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
    },
  });
}
