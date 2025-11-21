import {prisma} from "../../prisma/client.js"
import type { taskStatus } from "../generated/prisma/enums.js"
import type { TaskCreateInput } from "../generated/prisma/models.js"
import logger from "../utils/logger.utils.js";
import AppError from "../utils/app-error.utils.js";
import { ErrorCode } from "../common/error-codes.enum.js";

export const createTask = async (task: TaskCreateInput) => {
  try {
    return prisma.task.create({ data: task })
  } catch (error: any) {
    logger.error("createTask: Failed to create task", {
      taskId: task.id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to create task in database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const updateTask = async (id: string, data: { status: string }) => {
  try {
    return prisma.task.update({
      where: { id },
      data,
    })
  }
  catch (error: any) {
    logger.error("updateTask: Failed to update task", {
      taskId: id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to update task in database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const getTaskStatus = async (id: string) => {

  return prisma.task.findUnique({
    where: { id }
  })
;
}

export const deleteTask = async (id: string) => {
  try {
    return prisma.task.delete({
      where: { id }
    })
  } catch (error: any) {
    logger.error("deleteTask: Failed to delete task", {
      taskId: id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to delete task from database", 500, ErrorCode.DATABASE_ERROR);
  }
}
