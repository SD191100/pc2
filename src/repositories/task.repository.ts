import prisma from "../../prisma/client.js"
import type { taskStatus } from "../generated/prisma/enums.js"
import type { TaskCreateInput } from "../generated/prisma/models.js"

export const createTask = (task: TaskCreateInput) => {
  try {
    return prisma.task.create({ data: task })
  } catch (error) {
    console.error("error while creating task")
  }
}

export const updateTask = async (id: string, data: { status: string }) => {
  try {
    return prisma.task.update({
      where: { id },
      data,
    })
  }
  catch (error) {
    console.error("error in update task")
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
  } catch (error) {
    console.error("error in deleting task")
  }
}
