import { taskStatus } from "../generated/prisma/enums.js";
import { createTask, getTaskStatus } from "../repositories/task.repository.js";
import AppError from "../utils/app-error.utils.js";
import logger from "../utils/logger.utils.js";
import { ErrorCode } from "../common/error-codes.enum.js";


export const checkTaskStatus = async (id: string) => {
  try {
    const task = await getTaskStatus(id);
    if (!task) {
      logger.warn("checkTaskStatus: Task not found", { taskId: id });
      throw new AppError(`Task with id ${id} not found`, 404, ErrorCode.TASK_NOT_FOUND);
    }
    return task.status;
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw error;
    }
    logger.error("checkTaskStatus: Failed to retrieve task status", {
      taskId: id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(`Failed to retrieve task status`, 500, ErrorCode.INTERNAL_SERVER_ERROR, error.details);
  }
}

export const invokeTask = async (id: string) => {
  const task = {
    id,
    status: taskStatus.pending
  }
  try {
    return await createTask(task)
  } catch (error: any) {
    logger.error("invokeTask: Failed to create task", {
      taskId: id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to create task", 500, ErrorCode.INTERNAL_SERVER_ERROR, error.details);
  }
}
