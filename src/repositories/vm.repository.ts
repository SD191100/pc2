import type { VM } from "../models/vm.model.js";
import {prisma} from "../../prisma/client.js";
import type { VMCreateInput } from "../generated/prisma/models.js";
import logger from "../utils/logger.utils.js";
import AppError from "../utils/app-error.utils.js";
import { ErrorCode } from "../common/error-codes.enum.js";

export const CreateVmRecord = async (vm: VMCreateInput) => {
  logger.info("creating entry for vm with status creating...")
  try {
    return prisma.vM.create({ data: vm });
  } catch (error: any) {
    logger.error("CreateVmRecord: Failed to create VM record", {
      vmId: vm.vmId,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to create VM record in database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const FindVmById = async (id: string) => {
  return prisma.vM.findUnique({ where: { id } });
}

export const FindVmByVmId = async (vmId: string) => {
  return prisma.vM.findUnique({ where: {vmId}});
}

export const FindAllVms = async () => {
  return prisma.vM.findMany();
}

export const UpdateVmRecord = async (id: string, data: Partial<VM>) => {
  try {
    return prisma.vM.update({
      where: { id },
      data
    });
  } catch (error: any) {
    logger.error("UpdateVmRecord: Failed to update VM record", {
      recordId: id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to update VM record in database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const DeleteVmRecord = async (vmId: string) => {
  try {
    return prisma.vM.delete({
      where: { vmId }
    })
  } catch (error: any) {
    logger.error("DeleteVmRecord: Failed to delete VM record", {
      vmId,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to delete VM record from database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const FindVmByStackName = async (stackName: string) => {
  return prisma.vM.findUnique({
    where: { stackName }
  })
}
