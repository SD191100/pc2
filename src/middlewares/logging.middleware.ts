import type { NextFunction, Request, Response } from "express";
import logger from "../utils/Logger.utils.js";

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const { method, originalUrl } = req;
  const startTime = Date.now()

  res.on('finish', () => {
    const { statusCode } = res;
    const duration = Date.now() - startTime;
    logger.info(`${method} ${originalUrl} ${statusCode} - ${duration}`)
  })

  next();
}
