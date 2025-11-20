import { LocalWorkspace, type InlineProgramArgs, type LocalWorkspaceOptions } from "@pulumi/pulumi/automation/localWorkspace.js";
import { PulumiProxmoxProgram as PulumiProgram } from "../pulumi/pulumi.js";
import logger from "../utils/Logger.utils.js";
import AppError from "../utils/AppError.utils.js";
import { Agent } from 'undici';
import { formatDuration } from '../utils/Time.utils.js';
import type { VmInfo, CreateVMRequest } from '../types/compute.type.js';
import { CreateVmRecord, DeleteVmRecord, FindAllVms, FindVmById, UpdateVmRecord } from "../repositories/vm.repository.js";
import { taskStatus, VmStatus } from "../generated/prisma/browser.js";
import { ErrorCode } from "../common/error-codes.enum.js";
import { updateTask } from "../repositories/task.repository.js";

export const CreateOrUpdateVm = async (vm: CreateVMRequest, taskId: string) => {
  logger.debug("CreateOrUpdateVm: Starting VM creation/update", {
    vmId: vm.id,
    vmName: vm.name,
  });


  const id = crypto.randomUUID();

  try {
    logger.debug("CreateOrUpdateVm: Creating or selecting stack", {
      vmId: vm.id,
    });

    const stack = await createOrSelectStack(String(vm.id));

    logger.debug("CreateOrUpdateVm: Setting stack configuration", {
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
      storage: vm.storage,
      templateId: vm.templateId,
      ioAddress: vm.ioAddress,
      gateway: vm.gateway,
      username: vm.username,
      password: vm.password,
      stackName: stack.name,
      status: VmStatus.creating,
    };

    logger.debug("CreateOrUpdateVm: Creating VM record in database", {
      vmId: vm.id,
      recordId: id,
    });

    await CreateVmRecord(conf);
    logger.debug("CreateOrUpdateVm: updating record for task in database from pending to inProgress", {
      vmId: vm.id,
      recordId: id,
    });

    await updateTask(taskId, { status: taskStatus.inProgress });

    logger.info("CreateOrUpdateVm: Running Pulumi stack up", {
      vmId: vm.id,
      stackName: stack.name,
    });

    await stack.up({ onOutput: (msg: string) => logger.debug("Pulumi output", { vmId: vm.id, output: msg }) });

    logger.debug("CreateOrUpdateVm: Updating VM status to completed", {
      vmId: vm.id,
      recordId: id,
    });

    await UpdateVmRecord(id, { status: VmStatus.completed });
    logger.debug("CreateOrUpdateVm: Updating Task status to completed", {
      vmId: vm.id,
      taskId,
    });
    await updateTask(taskId, { status: taskStatus.completed });

    logger.info("CreateOrUpdateVm: VM creation/update completed successfully", {
      vmId: vm.id,
      recordId: id,
    });
  } catch (err: any) {
    logger.error("CreateOrUpdateVm: Failed to create/update VM", {
      vmId: vm.id,
      vmName: vm.name,
      error: err.message,
      stack: err.stack,
    });
    await UpdateVmRecord(id, { status: VmStatus.failed });
    await updateTask(taskId, { status: taskStatus.failed });
    throw new AppError(`Failed to create/update VM`, 500, ErrorCode.VM_CREATION_FAILED);
  }
};

export const DestroyVm = async (vm: string) => {
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

    await stack.destroy({ onOutput: (msg: string) => logger.debug("Pulumi destroy output", { vmId: vm, output: msg }) });

    logger.debug("DestroyVm: Removing stack from workspace", {
      vmId: vm,
      stackName: vmName,
    });

    await stack.workspace.removeStack(vmName, { force: true, preserveConfig: false });

    logger.debug("DestroyVm: Deleting VM record from database", {
      vmId: vm,
    });

    await DeleteVmRecord(vm);

    logger.info("DestroyVm: VM destruction completed successfully", {
      vmId: vm,
      stackName: vmName,
    });
  } catch (error: any) {
    logger.error("DestroyVm: Failed to destroy VM", {
      vmId: vm,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError(`Stack not found: ${error.message}`, 500, ErrorCode.PULUMI_STACK_ERROR);
  }
};

export const ListVms = async () => {
  logger.debug("ListVms: Starting VM list retrieval");

  const nodeName = process.env.PROXMOX_NODE || "proxmox";
  const tokenId = process.env.PROXMOX_API_TOKEN_ID;
  const tokenSecret = process.env.PROXMOX_API_TOKEN_SECRET;
  const endpoint = process.env.PROXMOX_ENDPOINT;
  const sslVerify = process.env.PROXMOX_SSL_VERIFY?.toLowerCase() !== 'false';

  if (!sslVerify) {
    logger.warn("ListVms: SSL verification is disabled - insecure configuration", {
      endpoint,
    });
  }

  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: sslVerify,
    },
  });

  const headers = {
    method: 'GET',
    headers: {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },
    dispatcher: dispatcher,
  };

  try {
    logger.debug("ListVms: Fetching VMs from Proxmox API", {
      endpoint,
      nodeName,
    });

    const response = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/`, headers);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("ListVms: Proxmox API error", {
        status: response.status,
        statusText: response.statusText,
        errorBody,
      });
      throw new Error(`Proxmox API Error: ${response.status} ${response.statusText}. Details: ${errorBody}`);
    }

    const vmStatus = await response.json();
    let allVms: VmInfo[] = [];
    const vmData = vmStatus.data;

    logger.debug("ListVms: Processing Proxmox VMs", {
      totalVmsFromProxmox: vmData.length,
    });

    for (let i = 0; i < vmData.length; i++) {
      if (vmData[i].template == 1) {
        logger.debug("ListVms: Skipping template VM", {
          vmId: vmData[i].vmid,
          vmName: vmData[i].name,
        });
        continue;
      }
      const time = formatDuration(vmData[i].uptime);
      allVms.push({
        vmId: vmData[i].vmid,
        cpus: vmData[i].cpus,
        memory: vmData[i].mem,
        name: vmData[i].name,
        status: vmData[i].status,
        uptime: time,
      });
    }

    logger.debug("ListVms: Fetching VMs from database", {
      proxmoxVmCount: allVms.length,
    });

    const output = await FindAllVms();

    logger.debug("ListVms: Filtering VMs by database records", {
      databaseVmCount: output.length,
      proxmoxVmCount: allVms.length,
    });

    let filteredOutput: VmInfo[] = [];

    for (let i = 0; i < output.length; i++) {
      for (let j = 0; j < allVms.length; j++) {
        if (output[i]?.vmId === allVms[j]?.vmId && allVms[j] !== undefined) {
          filteredOutput.push(allVms[j]!);
        }
      }
    }

    logger.info("ListVms: VM list retrieved successfully", {
      totalVms: filteredOutput.length,
    });

    return filteredOutput;
  } catch (error: any) {
    logger.error("ListVms: Failed to retrieve VM list", {
      endpoint,
      nodeName,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("failed to retrieve VM list", 500, ErrorCode.VM_STATE_FETCH_FAILED);
  }
};

export const GetVmState = async (vmId: string) => {
  logger.debug("GetVmState: Fetching VM state", {
    vmId,
  });

  const nodeName = process.env.PROXMOX_NODE || "proxmox";
  const tokenId = process.env.PROXMOX_API_TOKEN_ID;
  const tokenSecret = process.env.PROXMOX_API_TOKEN_SECRET;
  const endpoint = process.env.PROXMOX_ENDPOINT;
  const sslVerify = process.env.PROXMOX_SSL_VERIFY?.toLowerCase() !== 'false';

  if (!sslVerify) {
    logger.warn("GetVmState: SSL verification is disabled - insecure configuration", {
      endpoint,
    });
  }

  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: sslVerify,
    },
  });

  const headers = {
    method: 'GET',
    headers: {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },
    dispatcher: dispatcher,
  };

  try {
    logger.debug("GetVmState: Fetching VM state from Proxmox API", {
      vmId,
      endpoint,
      nodeName,
    });

    const response = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/${vmId}/status/current`, headers);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("GetVmState: Proxmox API error", {
        vmId,
        status: response.status,
        statusText: response.statusText,
        errorBody,
      });
      throw new Error(`Proxmox API Error: ${response.status} ${response.statusText}. Details: ${errorBody}`);
    }

    const vmStatus = await response.json();
    const time = formatDuration(vmStatus.data.uptime);
    const output = {
      vmId: vmStatus.data.vmid,
      cpus: vmStatus.data.cpus,
      memory: vmStatus.data.mem,
      name: vmStatus.data.name,
      status: vmStatus.data.status,
      uptime: time,
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
      endpoint,
      nodeName,
      error: error.message,
      stack: error.stack,
    });
    throw new AppError("failed to fetch vm state", 500, ErrorCode.VM_STATE_FETCH_FAILED);
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
    projectName: "provisioner-ts",
    program: PulumiProgram,
  };

  const opts: LocalWorkspaceOptions = {
    workDir: '/home/sd/.pulumi',
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
    throw new AppError(`Pulumi operation failed for stack ${stackName}`, 500, ErrorCode.PULUMI_STACK_ERROR);
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
    projectName: 'provisioner-ts',
    program: PulumiProgram,
  };

  const opts: LocalWorkspaceOptions = {
    workDir: '/home/sd/.pulumi',
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
    throw new AppError(`Pulumi operation failed for stack ${stackName}`, 500, ErrorCode.PULUMI_STACK_ERROR);
  }
};

