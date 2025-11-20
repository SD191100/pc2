import { taskStatus } from "../generated/prisma/enums.js";
import { createTask, getTaskStatus } from "../repositories/task.repository.js";
import AppError from "../utils/app-error.utils.js";
import logger from "../utils/logger.utils.js";


export const checkTaskStatus = async (id: string) => {
  try {
    const status = await getTaskStatus(id);
    return status?.status;
  } catch (error) {
    logger.error(`error creating task`);
    throw new AppError(`error creating task`, 500)
  }
}

export const invokeTask = async (id: string) => {
  const task = {
    id,
    status: taskStatus.pending
  }
  try {
    return await createTask(task)
  } catch (error) {
    logger.error(`error creating task`);
    throw new AppError(`error creating task`, 500)
  }
}
