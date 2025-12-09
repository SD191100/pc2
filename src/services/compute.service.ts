import {
  LocalWorkspace,
  type InlineProgramArgs,
  type LocalWorkspaceOptions,
} from "@pulumi/pulumi/automation/localWorkspace.js";
import { PulumiProxmoxProgram as PulumiProgram } from "../pulumi/pulumi.js";
import logger from "../utils/logger.utils.js";
import AppError from "../utils/app-error.utils.js";
import type {
  VmInfo,
  CreateVMRequest,
  UpdateVmRequest,
} from "../types/compute.type.js";
import {
  CreateVmRecord,
  DeleteVmRecord,
  FindAllVms,
  FindVmByVmId,
  UpdateVmRecord,
} from "../repositories/vm.repository.js";
import { taskStatus, VmCreationStatus } from "../generated/prisma/browser.js";
import { ErrorCode } from "../common/error-codes.enum.js";
import { updateTask } from "../repositories/task.repository.js";
import { invokeTask } from "./tasks.service.js";
import { ProxmoxApi } from "../utils/proxmox-api.utils.js";
import type { VM } from "../generated/prisma/client.js";
import { config } from "../config/index.js";
import { Agent } from "undici";

export const CreateVmService = async (vm: CreateVMRequest, taskId: string) => {
  const { id } = vm;

  let vmInfo = null;
  try {
    vmInfo = await FindVmByVmId(String(id));
  } catch (error: any) {
    if (error.statusCode === 404 || error.code === ErrorCode.VM_NOT_FOUND) {
      vmInfo = null; // this is OK, means not existing
    } else {
      throw error; // rethrow other errors
    }
  }
  if (vmInfo) {
    logger.error(`vm with ${id} already exist`);
    throw new AppError(
      `VM with id ${id} already exists`,
      409,
      ErrorCode.VM_CREATION_FAILED
    );
  }

  await invokeTask(taskId);
  logger.info("CreateVm: VM creation Task created successfully", {
    vmId: vm.id,
    vmName: vm.name,
  });

  // Fire-and-forget: start the async task without awaiting
  createVm(vm, taskId);
  return;
};

const createVm = async (vm: CreateVMRequest, taskId: string) => {
  logger.debug("CreateVm: Starting VM creation/update", {
    vmId: vm.id,
    vmName: vm.name,
  });

  const id = crypto.randomUUID();

  try {
    logger.debug("CreateVm: Creating or selecting stack", {
      vmId: vm.id,
    });

    const stack = await createOrSelectStack(String(vm.id));

    logger.debug("CreateVm: Setting stack configuration", {
      vmId: vm.id,
      stackName: stack.name,
    });

    await stack.setConfig("vm:name", { value: vm.name });
    await stack.setConfig("vm:cpu", { value: String(vm.cpu) });
    await stack.setConfig("vm:memory", { value: String(vm.memory) });
    await stack.setConfig("vm:storage", { value: String(vm.storage) });
    await stack.setConfig("vm:id", { value: String(vm.id) });
    await stack.setConfig("vm:ioAddress", { value: vm.ioAddress });
    await stack.setConfig("vm:gateway", { value: vm.gateway });
    await stack.setConfig("vm:username", { value: vm.username });
    await stack.setConfig("vm:sshKey", { value: vm.sshKey });
    await stack.setConfig("vm:password", { value: vm.password });
    await stack.setConfig("vm:templateId", { value: vm.templateId });

    const conf = {
      id,
      vmId: String(vm.id),
      name: vm.name,
      cpu: vm.cpu,
      memory: vm.memory,
      storage: Number(vm.storage),
      templateId: vm.templateId,
      ioAddress: vm.ioAddress,
      gateway: vm.gateway,
      username: vm.username,
      password: vm.password,
      sshKey: vm.sshKey,
      stackName: stack.name,
      status: VmCreationStatus.creating,
    };

    logger.debug("CreateVm: Creating VM record in database", {
      vmId: vm.id,
      recordId: id,
    });

    await CreateVmRecord(conf);
    logger.debug(
      "CreateVm: updating record for task in database from pending to inProgress",
      {
        vmId: vm.id,
        recordId: id,
      }
    );

    await updateTask(taskId, { status: taskStatus.inProgress });

    logger.info("CreateVm: Running Pulumi stack up", {
      vmId: vm.id,
      stackName: stack.name,
    });

    await stack.up({
      onOutput: (msg: string) =>
        logger.debug("Pulumi output", { vmId: vm.id, output: msg }),
    });

    logger.debug("CreateVm: Updating VM status to completed", {
      vmId: vm.id,
      recordId: id,
    });

    await UpdateVmRecord(id, { status: VmCreationStatus.completed });
    logger.debug("CreateVm: Updating Task status to completed", {
      vmId: vm.id,
      taskId,
    });
    await updateTask(taskId, { status: taskStatus.completed });

    logger.info("CreateVm: VM creation/update completed successfully", {
      vmId: vm.id,
      recordId: id,
    });
  } catch (err: any) {
    logger.error("CreateVm: Failed to create/update VM", {
      vmId: vm.id,
      vmName: vm.name,
      error: err.message,
      stack: err.stack,
    });
    await UpdateVmRecord(id, { status: VmCreationStatus.failed });
    await updateTask(taskId, { status: taskStatus.failed });
    throw new AppError(
      `Failed to create/update VM`,
      500,
      ErrorCode.VM_CREATION_FAILED
    );
  }
};

export const UpdateVmService = async (
  vmId: string,
  updateDto: UpdateVmRequest,
  taskId: string
) => {
  const vm: VM = await FindVmByVmId(String(vmId));
  if (!vm) {
    logger.error(`vm with ${vmId} not found`);
    throw new AppError(
      `VM with id ${vmId} not found`,
      404,
      ErrorCode.VM_NOT_FOUND
    );
  }

  await invokeTask(taskId);
  logger.info("UpdateVm: VM updation Task created successfully", {
    vmId: vmId,
    vmName: vm.name,
  });

  updateVm(vm, updateDto, taskId);
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const resize = async (vm: VM, storage: number) => {
  const nodeName = config.proxmox.node || "proxmox";
  const tokenId = config.proxmox.apiTokenId;
  const tokenSecret = config.proxmox.apiTokenSecret;
  const endpoint = config.proxmox.endpoint;
  const sslVerify = String(config.proxmox.sslVerify)?.toLowerCase() !== 'false';

  if (!sslVerify) {
    logger.warn("updateVm: SSL/TLS verification is disabled - insecure configuration");
  }

  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: sslVerify,
    },
  });

  const body = {
    disk: "scsi0",
    node: nodeName,
    size: `+${storage}G`,
    vmid: parseInt(vm.vmId)
  }

  const headers = {
    method: "PUT",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },

    body: JSON.stringify(body),
    dispatcher
  }

  try {
    // const res = await ProxmoxApi(`PUT`, `/qemu/${vm.vmId}/resize`, body)
    let res = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/${vm.vmId}/resize`, headers)
    const data = await res.json()
    console.log(data.data)
    const start = Date.now()

    while (true) {
      if (Date.now() - start > 60000) {
        throw new AppError("Timed out waiting for proxmox task to finish", 500);
      }
      const pollHeaders = {
        method: "GET",
        headers: {
          'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
        },
        dispatcher
      }
      res = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/tasks/${data.data}/status`, pollHeaders)
      const statusData = await res.json();
      const status = statusData?.data?.status;
      const exit = statusData?.data?.exitstatus;

      if (status === "stopped") {
        if (exit === "OK") break;
        throw new Error(`Proxmox task failed: ${exit}`);
      }
      await sleep(5000);
    }
    logger.info("UpdateVm: storage updated successfull", {
      vmId: vm.vmId,
      data
    })
  } catch (error: any) {
    logger.error("UpdateVm: Failed to update storage", {
      vmId: vm.id,
      vmName: vm.name,
      error: error.message,
      stack: error.stack,
    })
    throw new AppError(`error while updating storage`, 500)
  }
}

const updateVm = async (vm: VM, updateDto: UpdateVmRequest, taskId: string) => {
  const stack = await selectStack(String(vm.vmId));

  logger.debug("UpdateVm: Setting stack configuration", {
    vmId: vm.vmId,
    stackName: stack.name,
  });

  const { cpu, memory, storage } = updateDto;

  await updateTask(taskId, { status: taskStatus.inProgress });

  try {
   await stack.setConfig("vm:id", { value: String(vm.vmId) });
    await stack.setConfig("vm:name", { value: vm.name });
    await stack.setConfig("vm:cpu", { value: String(cpu ?? vm.cpu) });
    await stack.setConfig("vm:memory", { value: String(memory ?? vm.memory) });
    await stack.setConfig("vm:storage", { value: String(vm.storage) });
    await stack.setConfig("vm:ioAddress", { value: vm.ioAddress || "" });
    await stack.setConfig("vm:gateway", { value: vm.gateway || "" });
    await stack.setConfig("vm:username", { value: vm.username || "" });
    await stack.setConfig("vm:sshKey", { value: vm.sshKey || "" });
    await stack.setConfig("vm:password", { value: vm.password || "" });
    await stack.setConfig("vm:templateId", { value: vm.templateId || "" });
    if (storage && storage > 0) {
      await resize(vm, storage);
    }
    await stack.up({
      onOutput: (msg: string) =>
        logger.debug("Pulumi output", { vmId: vm.id, output: msg }),
    });

    await updateTask(taskId, { status: taskStatus.completed });

    const newVmConf = {
      ...vm,
      cpu: cpu ?? vm.cpu,
      memory: memory ?? vm.memory,
      storage: storage ? vm.storage + storage : vm.storage,
      stackName: stack.name,
      status: VmCreationStatus.completed,
    };

    await UpdateVmRecord(vm.id, newVmConf);

    logger.info("UpdateVm: VM updation completed successfully", {
      vmId: vm.id,
      vmName: vm.name,
    });
  } catch (err: any) {
    logger.error("UpdateVm: Failed to update VM", {
      vmId: vm.id,
      vmName: vm.name,
      error: err.message,
      stack: err.stack,
    });
    await updateTask(taskId, { status: taskStatus.failed });
    throw new AppError(
      `Failed to update VM`,
      500,
      ErrorCode.VM_UPDATION_FAILED
    );
  }
};

export const DestroyVmService = async (vmId: string, taskId: string) => {
  const vm = await FindVmByVmId(vmId); // repository call
  if (!vm) throw new AppError("VM not found", 404);

  await invokeTask(taskId);
  logger.info("DestroyVmService: VM creation Task created successfully", {
    vmId: vm.id,
    vmName: vm.name,
  });

  // Fire-and-forget async task
  destroyVm(vmId, taskId);

  return; // immediately return, controller can send 202
};

const destroyVm = async (vm: string, taskId: string) => {
  logger.debug("DestroyVm: Starting VM destruction", {
    vmId: vm,
  });
  try {
    logger.debug("DestroyVm: Selecting stack", {
      vmId: vm,
    });

    const stack = await selectStack(String(vm));
    const vmName = stack.name;

    logger.info("DestroyVm: Running Pulumi stack destroy", {
      vmId: vm,
      stackName: vmName,
    });
    await updateTask(taskId, { status: taskStatus.inProgress });

    await stack.destroy({
      onOutput: (msg: string) =>
        logger.debug("Pulumi destroy output", { vmId: vm, output: msg }),
    });

    logger.debug("DestroyVm: Removing stack from workspace", {
      vmId: vm,
      stackName: vmName,
    });

    await stack.workspace.removeStack(vmName, {
      force: true,
      preserveConfig: false,
    });

    logger.debug("DestroyVm: Deleting VM record from database", {
      vmId: vm,
    });

    await DeleteVmRecord(vm);

    logger.info("DestroyVm: VM destruction completed successfully", {
      vmId: vm,
      stackName: vmName,
    });

    await updateTask(taskId, { status: taskStatus.completed });
  } catch (error: any) {
    logger.error("DestroyVm: Failed to destroy VM", {
      vmId: vm,
      error: error.message,
      stack: error.stack,
    });
    await updateTask(taskId, { status: taskStatus.failed });
    throw new AppError(
      `Stack not found: ${error.message}`,
      500,
      ErrorCode.PULUMI_STACK_ERROR
    );
  }
};

export const ListVms = async () => {
  logger.debug("ListVms: Starting VM list retrieval");

  try {
    const output = await FindAllVms();

    logger.debug("ListVms: Filtering VMs by database records", {
      databaseVmCount: output.length,
    });

    let filteredOutput: VmInfo[] = [];

    for (let i = 0; i < output.length; i++) {
      const item = output[i];
      if (!item || item.vmId === undefined) continue;

      const outputVm: VmInfo = {
        vmId: Number(item.vmId),
        cpus: Number(item.cpu),
        memory: Number(item.memory),
        name: item.name || "",
        status: item.runtimeStatus || "",
        uptime: "",
      };

      filteredOutput.push(outputVm);
    }

    logger.info("ListVms: VM list retrieved successfully", {
      totalVms: filteredOutput.length,
    });

    return filteredOutput;
  } catch (error: any) {
    logger.error("ListVms: Failed to retrieve VM list", {
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(
      "failed to retrieve VM list",
      500,
      ErrorCode.VM_STATE_FETCH_FAILED
    );
  }
};

export const GetVmState = async (vmId: string) => {
  logger.debug("GetVmState: Fetching VM state", {
    vmId,
  });

  try {
    const vm = await FindVmByVmId(vmId);
    if (!vm) {
      logger.error("GetVmState: Failed to retrieve VM", {});
      throw new AppError("failed to retrieve VM", 404, ErrorCode.VM_NOT_FOUND);
    }

    const output = {
      vmId: vm.vmId,
      cpus: vm.cpu,
      memory: vm.memory,
      name: vm.name,
      status: vm.runtimeStatus,
    };

    logger.debug("GetVmState: VM state retrieved successfully", {
      vmId,
      vmName: output.name,
      vmStatus: output.status,
    });

    return { output };
  } catch (error: any) {
    logger.error("GetVmState: Failed to fetch VM state", {
      vmId,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(
      "failed to fetch vm state",
      500,
      ErrorCode.VM_STATE_FETCH_FAILED
    );
  }
};

const selectStack = async (vmId: string) => {
  const stackName: string = `vm-${vmId}`;

  logger.debug("selectStack: Selecting Pulumi stack", {
    vmId,
    stackName,
  });

  const args: InlineProgramArgs = {
    stackName,
    projectName: "pc2",
    program: PulumiProgram,
  };

  const opts: LocalWorkspaceOptions = {
    workDir: config.pulumi.workDir,
    envVars: {
      PULUMI_BACKEND_URL: config.pulumi.backendUrl || "",
      AWS_ACCESS_KEY_ID: config.pulumi.accessKeyId || "",
      AWS_SECRET_ACCESS_KEY: config.pulumi.secretAccessKey || "",
      AWS_REGION: config.pulumi.region || "",
      PULUMI_CONFIG_PASSPHRASE: config.pulumi.configPassphrase || "",
    },
  };

  try {
    logger.debug("selectStack: Connecting to Pulumi workspace", {
      vmId,
      stackName,
      workDir: opts.workDir,
    });

    const stack = await LocalWorkspace.selectStack(args, opts);

    logger.debug("selectStack: Stack selected successfully", {
      vmId,
      stackName,
    });

    return stack;
  } catch (error: any) {
    logger.error("selectStack: Failed to select stack", {
      vmId,
      stackName,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(
      `Pulumi operation failed for stack ${stackName}`,
      500,
      ErrorCode.PULUMI_STACK_ERROR
    );
  }
};

export const createOrSelectStack = async (vmId: string) => {
  const stackName = `vm-${vmId}`;

  logger.debug("createOrSelectStack: Creating or selecting Pulumi stack", {
    vmId,
    stackName,
  });

  const args: InlineProgramArgs = {
    stackName,
    projectName: "pc2",
    program: PulumiProgram,
  };

  const opts: LocalWorkspaceOptions = {
    workDir: config.pulumi.workDir,
    envVars: {
      PULUMI_BACKEND_URL: config.pulumi.backendUrl || "",
      AWS_ACCESS_KEY_ID: config.pulumi.accessKeyId || "",
      AWS_SECRET_ACCESS_KEY: config.pulumi.secretAccessKey || "",
      AWS_REGION: config.pulumi.region || "",
      PULUMI_CONFIG_PASSPHRASE: config.pulumi.configPassphrase || "",
    },
  };

  try {
    logger.debug("createOrSelectStack: Connecting to Pulumi workspace", {
      vmId,
      stackName,
      workDir: opts.workDir,
    });

    const stack = await LocalWorkspace.createOrSelectStack(args, opts);

    logger.info("createOrSelectStack: Stack created or selected successfully", {
      vmId,
      stackName,
    });

    return stack;
  } catch (error: any) {
    logger.error("createOrSelectStack: Failed to create or select stack", {
      vmId,
      stackName,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(
      `Pulumi operation failed for stack ${stackName}`,
      500,
      ErrorCode.PULUMI_STACK_ERROR
    );
  }
};

export const StartVmService = async (vmId: string) => {
  const vm = await FindVmByVmId(vmId);
  if (!vm) throw new AppError("VM not found", 404, ErrorCode.VM_NOT_FOUND);

  if (vm.runtimeStatus === "running") {
    throw new AppError(
      "VM is already running",
      409,
      ErrorCode.VM_ALREADY_STARTED
    );
  }

  try {
    StartVm(vmId);
  } catch (error: any) {
    logger.error("StartVmService: Failed to start VM", {
      vmId,
      error: error.message,
      stack: error.stack,
    });

    // Map specific Proxmox errors to user-friendly codes
    let userErrorCode = ErrorCode.VM_START_FAILED;
    let userMessage = "Failed to start VM";

    if (error.details?.apiError?.includes("permission denied")) {
      userErrorCode = ErrorCode.PERMISSION_DENIED;
      userMessage = "Insufficient permissions to start VM";
    } else if (error.details?.apiError?.includes("node offline")) {
      userErrorCode = ErrorCode.HYPERVISOR_OFFLINE;
      userMessage = "Hypervisor node is offline";
    } else if (error.details?.apiError?.includes("VM not found")) {
      userErrorCode = ErrorCode.VM_NOT_FOUND;
      userMessage = "VM not found";
    }

    throw new AppError(userMessage, error.statusCode || 500, userErrorCode);
  }
};

const StartVm = async (vmId: string) => {
  const res = await ProxmoxApi("POST", `/qemu/${vmId}/status/start`);

  if (!res.ok) {
    const errorBody = await res.text();
    const errorDetails = {
      status: res.status,
      statusText: res.statusText,
      apiError: errorBody,
      endpoint: `/qemu/${vmId}/status/start`,
    };

    logger.error("StartVmService: Proxmox API error", errorDetails);

    throw new AppError(
      `Proxmox API Error: ${res.status} ${res.statusText}`,
      res.status,
      ErrorCode.VM_START_FAILED,
      errorDetails
    );
  }

  const startRes: any = await res.json();

  logger.info("StartVmService: VM started successfully", {
    vmId,
    startRes,
  });
};

export const StopVmService = async (vmId: string) => {
  const vm = await FindVmByVmId(vmId);
  if (!vm) throw new AppError("VM not found", 404, ErrorCode.VM_NOT_FOUND);

  if (vm.runtimeStatus === "stopped") {
    throw new AppError(
      "VM is already stopped",
      409,
      ErrorCode.VM_ALREADY_STOPPED
    );
  }

  try {
    await StopVm(vmId);
  } catch (error: any) {
    logger.error("StopVmService: Failed to stop VM", {
      vmId,
      error: error.message,
      stack: error.stack,
    });

    // Map specific Proxmox errors to user-friendly codes
    let userErrorCode = ErrorCode.VM_STOP_FAILED;
    let userMessage = "Failed to stop VM";

    if (error.details?.apiError?.includes("permission denied")) {
      userErrorCode = ErrorCode.PERMISSION_DENIED;
      userMessage = "Insufficient permissions to stop VM";
    } else if (error.details?.apiError?.includes("node offline")) {
      userErrorCode = ErrorCode.HYPERVISOR_OFFLINE;
      userMessage = "Hypervisor node is offline";
    } else if (error.details?.apiError?.includes("VM not found")) {
      userErrorCode = ErrorCode.VM_NOT_FOUND;
      userMessage = "VM not found";
    }

    throw new AppError(userMessage, error.statusCode || 500, userErrorCode);
  }
};

const StopVm = async (vmId: string) => {
  const res = await ProxmoxApi("POST", `/qemu/${vmId}/status/stop`);

  if (!res.ok) {
    const errorBody = await res.text();
    const errorDetails = {
      status: res.status,
      statusText: res.statusText,
      apiError: errorBody,
      endpoint: `/qemu/${vmId}/status/stop`,
    };

    logger.error("StopVmService: Proxmox API error", errorDetails);

    throw new AppError(
      `Proxmox API Error: ${res.status} ${res.statusText}`,
      res.status,
      ErrorCode.VM_STOP_FAILED,
      errorDetails
    );
  }

  const stopRes: any = await res.json();

  logger.info("StopVmService: VM stopped successfully", {
    vmId,
    stopRes,
  });
};

export const RestartVmService = async (vmId: string) => {
  const vm = await FindVmByVmId(vmId);
  if (!vm) throw new AppError("VM not found", 404, ErrorCode.VM_NOT_FOUND);

  if (vm.runtimeStatus === "stopped") {
    throw new AppError(
      "VM is already stopped",
      409,
      ErrorCode.VM_ALREADY_STOPPED
    );
  }

  try {
    await RestartVm(vmId);
  } catch (error: any) {
    logger.error("RestartVmService: Failed to restart VM", {
      vmId,
      error: error.message,
      stack: error.stack,
    });

    // Map specific Proxmox errors to user-friendly codes
    let userErrorCode = ErrorCode.VM_RESTART_FAILED;
    let userMessage = "Failed to restart VM";

    if (error.details?.apiError?.includes("permission denied")) {
      userErrorCode = ErrorCode.PERMISSION_DENIED;
      userMessage = "Insufficient permissions to restart VM";
    } else if (error.details?.apiError?.includes("node offline")) {
      userErrorCode = ErrorCode.HYPERVISOR_OFFLINE;
      userMessage = "Hypervisor node is offline";
    } else if (error.details?.apiError?.includes("VM not found")) {
      userErrorCode = ErrorCode.VM_NOT_FOUND;
      userMessage = "VM not found";
    } else if (error.details?.apiError?.includes("VM is not running")) {
      userErrorCode = ErrorCode.VM_ALREADY_STOPPED;
      userMessage = "VM must be running to restart";
    }

    throw new AppError(userMessage, error.statusCode || 500, userErrorCode);
  }
};

const RestartVm = async (vmId: string) => {
  const res = await ProxmoxApi("POST", `/qemu/${vmId}/status/reboot`);

  if (!res.ok) {
    const errorBody = await res.text();
    const errorDetails = {
      status: res.status,
      statusText: res.statusText,
      apiError: errorBody,
      endpoint: `/qemu/${vmId}/status/reboot`,
    };

    logger.error("RestartVmService: Proxmox API error", errorDetails);

    throw new AppError(
      `Proxmox API Error: ${res.status} ${res.statusText}`,
      res.status,
      ErrorCode.VM_RESTART_FAILED,
      errorDetails
    );
  }

  const restartRes: any = await res.json();

  logger.info("RestartVmService: VM restarted successfully", {
    vmId,
    restartRes,
  });
};
