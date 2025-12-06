import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import type { CreateVMRequest, UpdateVmRequest } from "../types/compute.type.js";
import { CreateVmService, DestroyVmService, GetVmState, ListVms, RestartVmService, StartVmService, StopVmService, UpdateVmService } from "../services/compute.service.js";
import logger from "../utils/logger.utils.js";
import { sendError, sendPaginated, sendSuccess } from "../common/response.util.js";
import { ErrorCode } from "../common/error-codes.enum.js";
import { invokeTask } from "../services/tasks.service.js";
import { FindVmByVmId } from "../repositories/vm.repository.js";
import { FetchAllState } from "../utils/state-fetcher.utils.js";


export const CreateVm = async (req: Request, res: Response) => {
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
    sendError(res, 400, "Missing required VM configuration.", undefined, ErrorCode.VALIDATION_ERROR)
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


    const id = randomUUID()

    await CreateVmService(vmConfig, id);

    logger.info("CreateVm: VM creation initiated successfully", {
      requestId,
      vmId: vmConfig.id,
      vmName: vmConfig.name,
    });
    
    sendSuccess(res, 202, `VM Creation for '${vmConfig.name}' has been started.`, { taskId: id });
  } catch (error: any) {
    logger.error("CreateVm: Failed to create VM", {
      requestId,
      vmName: vmConfig.name,
      error: error.message,
      stack: error.stack,
    });

    // Handle different error types
    if (error.statusCode === 409) {
      sendError(res, 409, error.message, undefined, error.errorCode);
    } else {
      sendError(res, 500, `internal server error`, error.message, error.errorCode)
    }
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
    sendError(res, 400, "VM_id is required.", undefined, ErrorCode.VALIDATION_ERROR)
    return;
  }

  try {
    logger.info("DeleteVm: Deleting VM", {
      requestId,
      vmId,
    });

    const id = randomUUID();

    const vm = await FindVmByVmId(vmId);
    if (!vm) {
      sendError(res, 404, `VM ${vmId} not found`, undefined, ErrorCode.VM_NOT_FOUND);
      return;
    }

    await DestroyVmService(vmId, id);

    logger.info("DeleteVm: VM deletion initiated successfully", {
      requestId,
      vmId,
    });

    sendSuccess(res, 202, `VM destruction for ${vmId} has been started.`, { taskId: id })
  } catch (error: any) {
    logger.error("DeleteVm: Failed to delete VM", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, 500, `internal server error while deleting vm`, error.message, error.errorCode)
  }
};

export const GetVms = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const pageNum = parseInt(String(req.query.page)) || 1;
  const limitNum = parseInt(String(req.query.limit)) || 10;

  logger.debug("GetVms: Fetching all VMs", {
    requestId,
  });

  try {
    logger.info("GetVms: Retrieving VMs from service", {
      requestId,
    });

    const vms = await ListVms();

    logger.debug("GetVms: VMs retrieved successfully", {
      requestId,
      vmCount: vms?.length || 0,
    });
    sendPaginated(res, 200, "list fetched successfully", vms, vms.length, pageNum, limitNum)
  } catch (error: any) {
    logger.error("GetVms: Failed to retrieve VMs", {
      requestId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, 500, `failed to retrieve VMs`, error.message, error.errorCode)
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
    sendError(res, 400, "VM id is required.", undefined, ErrorCode.VALIDATION_ERROR);
    return;
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
    sendSuccess(res, 200, "vm state fetched successfully", state)
  } catch (error: any) {
    logger.error("GetVm: Failed to retrieve VM state", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, 500, `Failed to retrieve VM state`, error.message, error.errorCode)
  }
};

export const UpdateVm = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { vmId } = req.params;
  const { cpu, memory, storage } = req.body;

  if (vmId === undefined) {
    logger.warn("UpdateVm: Validation failed - vmId is required", {
      requestId,
    });
    sendError(res, 400, "VM id is required.", undefined, ErrorCode.VALIDATION_ERROR);
    return;
  }

  const updateDto: UpdateVmRequest = {
    cpu,
    memory,
    storage
  }
  
  try {
    logger.info("UpdateVm: Updating VM", {
      requestId,
      vmId,
    });

    const taskId = randomUUID();

    await UpdateVmService(vmId, updateDto, taskId);
    sendSuccess(res, 202, `VM update for ${vmId} has been started.`, { taskId })
  } catch (error: any) {
    logger.error("UpdateVm: Failed to update VM", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, error.statusCode || 500, error.message, undefined, error.errorCode)
  }
}

export const StartVm = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { vmId } = req.params;

  if (vmId === undefined) {
    logger.warn("StartVm: Validation failed - vmId is required", {
      requestId,
    });
    sendError(res, 400, "VM id is required.", undefined, ErrorCode.VALIDATION_ERROR);
    return;
  }
  
  try {
    logger.info("StartVm: Starting VM", {
      requestId,
      vmId,
    });

    await StartVmService(vmId);
    sendSuccess(res, 202, `VM start for ${vmId} has been started.`)
  } catch (error: any) {
    logger.error("StartVm: Failed to start VM", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, error.statusCode || 500, error.message, undefined, error.errorCode)
  }
}
export const StopVm = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { vmId } = req.params;

  if (vmId === undefined) {
    logger.warn("StopVm: Validation failed - vmId is required", {
      requestId,
    });
    sendError(res, 400, "VM id is required.", undefined, ErrorCode.VALIDATION_ERROR);
    return;
  }

  try {
    logger.info("StopVm: Stopping VM", {
      requestId,
      vmId,
    });

    await StopVmService(vmId);
    sendSuccess(res, 202, `VM stop for ${vmId} has been started.`)
  } catch (error: any) {
    logger.error("StopVm: Failed to stop VM", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, error.statusCode || 500, error.message, undefined, error.errorCode)
  }
}
export const RestartVm = async (req: Request, res: Response) => {
  const requestId = (req as any).requestId;
  const { vmId } = req.params;

  if (vmId === undefined) {
    logger.warn("RestartVm: Validation failed - vmId is required", {
      requestId,
    });
    sendError(res, 400, "VM id is required.", undefined, ErrorCode.VALIDATION_ERROR);
    return;
  }

  try {
    logger.info("RestartVm: Restarting VM", {
      requestId,
      vmId,
    });

    await RestartVmService(vmId);    
    sendSuccess(res, 202, `VM restart for ${vmId} has been started.`)
  } catch (error: any) {
    logger.error("RestartVm: Failed to restart VM", {
      requestId,
      vmId,
      error: error.message,
      stack: error.stack,
    });
    sendError(res, error.statusCode || 500, error.message, undefined, error.errorCode)
  }
}


