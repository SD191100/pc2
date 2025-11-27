import type { Request, Response } from "express";
import { checkTaskStatus } from "../services/tasks.service.js"
import { sendError, sendSuccess } from "../common/response.util.js";
import logger from "../utils/logger.utils.js";
import { ErrorCode } from "../common/error-codes.enum.js";

export const getTask = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const id = req.params.taskId;

  if (id == undefined || id == null) {
    logger.warn("getTask: Validation failed - taskId is required", {
      requestId
    });

    sendError(res, 400, "taskId is required for this task", undefined, ErrorCode.VALIDATION_ERROR);
    return
  }

  try {

    const status = await checkTaskStatus(id);
    sendSuccess(res, 200, "task status fetched successfully", { status: status })
  } catch (error: any) {
    logger.error("getTask: Failed to retrieve task status", {
      requestId,
      taskId: id,
      error: error.message,
      stack: error.stack,
    });
    
    // Handle different error types
    if (error.statusCode === 404) {
      sendError(res, 404, error.message, undefined, error.errorCode);
    } else {
      sendError(res, 500, `internal server error`, error.message, error.errorCode);
    }
  }
}
