import {
  LocalWorkspace,
  type InlineProgramArgs,
  type LocalWorkspaceOptions,
} from "@pulumi/pulumi/automation/localWorkspace.js";
import { PulumiProxmoxProgram as PulumiProgram } from "../pulumi/pulumi.js";
import logger from "../utils/logger.utils.js";
import AppError from "../utils/app-error.utils.js";
import type { VmInfo, CreateVMRequest } from "../types/compute.type.js";
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

export const CreateVmService = async (vm: CreateVMRequest, taskId: string) => {
  const { id } = vm;

  const vmInfo = await FindVmByVmId(String(id));
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
  createOrUpdateVm(vm, taskId);
  return;
};

const createOrUpdateVm = async (vm: CreateVMRequest, taskId: string) => {
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
      status: VmCreationStatus.creating,
    };

    logger.debug("CreateOrUpdateVm: Creating VM record in database", {
      vmId: vm.id,
      recordId: id,
    });

    await CreateVmRecord(conf);
    logger.debug(
      "CreateOrUpdateVm: updating record for task in database from pending to inProgress",
      {
        vmId: vm.id,
        recordId: id,
      }
    );

    await updateTask(taskId, { status: taskStatus.inProgress });

    logger.info("CreateOrUpdateVm: Running Pulumi stack up", {
      vmId: vm.id,
      stackName: stack.name,
    });

    await stack.up({
      onOutput: (msg: string) =>
        logger.debug("Pulumi output", { vmId: vm.id, output: msg }),
    });

    logger.debug("CreateOrUpdateVm: Updating VM status to completed", {
      vmId: vm.id,
      recordId: id,
    });

    await UpdateVmRecord(id, { status: VmCreationStatus.completed });
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
    await UpdateVmRecord(id, { status: VmCreationStatus.failed });
    await updateTask(taskId, { status: taskStatus.failed });
    throw new AppError(
      `Failed to create/update VM`,
      500,
      ErrorCode.VM_CREATION_FAILED
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
    projectName: "provisioner-ts",
    program: PulumiProgram,
  };

  const opts: LocalWorkspaceOptions = {
    workDir: "/home/sd/.pulumi",
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
    projectName: "provisioner-ts",
    program: PulumiProgram,
  };

  const opts: LocalWorkspaceOptions = {
    workDir: "/home/sd/.pulumi",
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
