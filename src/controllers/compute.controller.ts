import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import type { CreateVMRequest } from "../types/compute.type.js";
import { CreateVmService, DestroyVmService, GetVmState, ListVms } from "../services/compute.service.js";
import logger from "../utils/logger.utils.js";
import { sendError, sendPaginated, sendSuccess } from "../common/response.util.js";
import { ErrorCode } from "../common/error-codes.enum.js";
import { invokeTask } from "../services/tasks.service.js";
import { FindVmByVmId } from "../repositories/vm.repository.js";


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
      sendError(res, 500, `internal server error`, undefined, ErrorCode.INTERNAL_SERVER_ERROR);
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
    sendError(res, 500, `internal server error while deleting vm`, undefined, ErrorCode.INTERNAL_SERVER_ERROR)
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
    sendError(res, 500, `failed to retrieve VMs`, undefined, ErrorCode.INTERNAL_SERVER_ERROR)
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
    sendError(res, 500, `Failed to retrieve VM state`, undefined, ErrorCode.VM_STATE_FETCH_FAILED)
  }
};

export const UpdateVm = CreateVm;

export const StartVm = (req: Request, res: Response) => {
  // const { }
}
export const StopVm = (req: Request, res: Response) => {

}
export const RestartVm = (req: Request, res: Response) => {

}


