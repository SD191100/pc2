import type { Request, Response } from "express";
import { checkTaskStatus } from "../services/tasks.service.js"
import { sendError, sendSuccess } from "../common/response.util.js";
import logger from "../utils/Logger.utils.js";

export const getTask = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const id = req.params.taskId;

  if (id == undefined || id == null) {
    logger.warn("CreateVm: Validation failed - missing required fields", {
      requestId
    });

    sendError(res, 400, "taskId is required for this task");
    return
  }

  try {

    const status = await checkTaskStatus(id);
    sendSuccess(res, 200, "task status fetched successfully", { status: status })
  } catch (error: any) {
    logger.error("CreateVm: Failed to create VM", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, 500, `internal server error`);
  }
}

