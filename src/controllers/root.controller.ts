import type { Request, Response } from "express";
import logger from "../utils/Logger.utils.js";
import { sendSuccess } from "../common/response.util.js";

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


  sendSuccess(res, 200, "reached to the compute api, Hello friend", {
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
};
