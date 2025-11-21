import type { VM } from "../models/vm.model.js";
import {prisma} from "../../prisma/client.js";
import type { VMCreateInput } from "../generated/prisma/models.js";
import logger from "../utils/logger.utils.js";

export const CreateVmRecord = async (vm: VMCreateInput) => {
  logger.info("creating entry for vm with status creating...")
  try {
    return prisma.vM.create({ data: vm });
  } catch (error) {
    console.error(`not created, ${error}`)
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
  } catch (error) {
    console.error("error in update")
  }
}

export const DeleteVmRecord = (vmId: string) => {
  try {
    return prisma.vM.delete({
      where: { vmId }
    })
  } catch (error) {
    logger.error(`error in delete`)
  }
}

export const FindVmByStackName = async (stackName: string) => {
  return prisma.vM.findUnique({
    where: { stackName }
  })
}
