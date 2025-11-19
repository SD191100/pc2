import type { NextFunction, Request, Response } from "express";
import type { CreateVMRequest } from "../types/compute.type.js";
import { CreateOrUpdateVm, DestroyVm, GetVmState, ListVms } from "../services/compute.service.js";
import logger from "../utils/Logger.utils.js";
import AppError from "../utils/AppError.utils.js";


export const CreateVm = async (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;
  const vmConfig: CreateVMRequest = req.body;

  logger.debug("CreateVm: Starting VM creation", {
    requestId,
    vmName: vmConfig?.name,
  });

  // Validate required fields
  if (!vmConfig || !vmConfig.name || !vmConfig.cpu || !vmConfig.memory || !vmConfig.storage || !vmConfig.id || !vmConfig.ioAddress || !vmConfig.gateway) {
    logger.warn("CreateVm: Validation failed - missing required fields", {
      requestId,
      providedFields: vmConfig ? Object.keys(vmConfig) : [],
    });
    res.status(400).json({ message: "Missing required VM configuration." });
    return;
  }

  // Set defaults for optional fields
  if (!vmConfig.username || !vmConfig.password) {
    logger.debug("CreateVm: Setting default credentials", { requestId });
    vmConfig.username = "administrator";
    vmConfig.password = "administrator";
  }

  if (!vmConfig.sshKey) {
    logger.debug("CreateVm: SSH key not provided, will use default", { requestId });
  }

  try {
    logger.info("CreateVm: Creating VM", {
      requestId,
      vmId: vmConfig.id,
      vmName: vmConfig.name,
      cpu: vmConfig.cpu,
      memory: vmConfig.memory,
      storage: vmConfig.storage,
    });

    CreateOrUpdateVm(vmConfig);

    logger.info("CreateVm: VM creation initiated successfully", {
      requestId,
      vmId: vmConfig.id,
      vmName: vmConfig.name,
    });

    res.status(200).json({
      message: `VM Creation for '${vmConfig.name}' has been started.`,
    });
  } catch (error: any) {
    logger.error("CreateVm: Failed to create VM", {
      requestId,
      vmName: vmConfig.name,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: `[error] ${error.message}` });
  }
};


export const DeleteVm = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { vmId } = req.params;

  logger.debug("DeleteVm: Starting VM deletion", {
    requestId,
    vmId,
  });

  if (!vmId) {
    logger.warn("DeleteVm: Validation failed - vmId is required", {
      requestId,
    });
    return res.status(400).json({ message: "VM id is required." });
  }

  try {
    logger.info("DeleteVm: Deleting VM", {
      requestId,
      vmId,
    });

    DestroyVm(vmId);

    logger.info("DeleteVm: VM deletion initiated successfully", {
      requestId,
      vmId,
    });

    res.status(202).json({
      message: `VM destruction for 'vm-${vmId}' has been started.`,
    });
  } catch (error: any) {
    logger.error("DeleteVm: Failed to delete VM", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: `[error] ${error.message}` });
  }
};

export const GetAllVms = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;

  logger.debug("GetAllVms: Fetching all VMs", {
    requestId,
  });

  try {
    logger.info("GetAllVms: Retrieving VMs from service", {
      requestId,
    });

    const vms = await ListVms();

    logger.debug("GetAllVms: VMs retrieved successfully", {
      requestId,
      vmCount: vms?.length || 0,
    });

    res.status(200).json({ message: "list fetched successfully", output: vms });
  } catch (error: any) {
    logger.error("GetAllVms: Failed to retrieve VMs", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: `[error] ${error.message}` });
  }
};

export const GetVm = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { vmId } = req.params;

  logger.debug("GetVm: Fetching VM details", {
    requestId,
    vmId,
  });

  if (!vmId) {
    logger.warn("GetVm: Validation failed - vmId is required", {
      requestId,
    });
    return res.status(400).json({ message: "VM id is required." });
  }

  try {
    logger.info("GetVm: Retrieving VM state from service", {
      requestId,
      vmId,
    });

    const state = await GetVmState(vmId);

    logger.debug("GetVm: VM state retrieved successfully", {
      requestId,
      vmId,
    });

    res.status(200).json({ message: "vm fetched successfully", output: state });
  } catch (error: any) {
    logger.error("GetVm: Failed to retrieve VM state", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: `[error] ${error.message}` });
  }
};

export const UpdateVm = CreateVm;


