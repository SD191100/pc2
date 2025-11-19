import type { Request, Response } from "express";
import logger from "../utils/Logger.utils.js";

export const GetRoot = (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  logger.debug("GetRoot: Health check requested", {
    requestId,
  });

  logger.info("GetRoot: Service is healthy", {
    requestId,
    service: "compute-api",
    timestamp: new Date().toISOString(),
  });

  res.status(200).json({ 
    message: "reached to the compute api, Hello friend",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
};
