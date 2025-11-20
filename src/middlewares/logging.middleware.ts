import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import logger from "../utils/logger.utils.js";

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID using crypto
  const requestId = randomUUID();
  const { method, originalUrl, ip } = req;
  const startTime = Date.now();

  // Attach requestId to request object for use in controllers
  (req as any).requestId = requestId;

  // Log incoming request
  logger.info("Incoming request", {
    requestId,
    method,
    url: originalUrl,
    ip,
    timestamp: new Date().toISOString(),
  });

  // Log response when finished
  res.on("finish", () => {
    const { statusCode } = res;
    const duration = Date.now() - startTime;
    const logLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

    logger.log(logLevel, "Request completed", {
      requestId,
      method,
      url: originalUrl,
      statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  next();
};
