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
  try {
    const vm = await prisma.vM.findUnique({ where: { id } });
    
    if (!vm) {
      logger.warn("FindVmById: VM not found", { recordId: id });
      throw new AppError(`VM with record id ${id} not found`, 404, ErrorCode.VM_NOT_FOUND);
    }
    
    return vm;
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw error;
    }
    logger.error("FindVmById: Failed to retrieve VM", {
      recordId: id,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to retrieve VM from database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const FindVmByVmId = async (vmId: string) => {
  try {
    const vm = await prisma.vM.findUnique({ where: {vmId}});
    
    if (!vm) {
      logger.warn("FindVmByVmId: VM not found", { vmId });
      throw new AppError(`VM with vmId ${vmId} not found`, 404, ErrorCode.VM_NOT_FOUND);
    }
    
    return vm;
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw error;
    }
    logger.error("FindVmByVmId: Failed to retrieve VM", {
      vmId,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to retrieve VM from database", 500, ErrorCode.DATABASE_ERROR);
  }
}

export const FindAllVms = async () => {
  try {
    const vms = await prisma.vM.findMany();
    
    logger.debug("FindAllVms: Retrieved VMs successfully", {
      vmCount: vms.length,
    });
    
    return vms;
  } catch (error: any) {
    logger.error("FindAllVms: Failed to retrieve VMs", {
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to retrieve VMs from database", 500, ErrorCode.DATABASE_ERROR);
  }
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
  try {
    const vm = await prisma.vM.findUnique({
      where: { stackName }
    });
    
    if (!vm) {
      logger.warn("FindVmByStackName: VM not found", { stackName });
      throw new AppError(`VM with stack name ${stackName} not found`, 404, ErrorCode.VM_NOT_FOUND);
    }
    
    return vm;
  } catch (error: any) {
    if (error.statusCode === 404) {
      throw error;
    }
    logger.error("FindVmByStackName: Failed to retrieve VM", {
      stackName,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("Failed to retrieve VM from database", 500, ErrorCode.DATABASE_ERROR);
  }
}
