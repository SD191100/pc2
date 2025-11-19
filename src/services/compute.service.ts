import { LocalWorkspace, type InlineProgramArgs, type LocalWorkspaceOptions } from "@pulumi/pulumi/automation/localWorkspace.js";
import { PulumiProxmoxProgram as PulumiProgram } from "../pulumi/pulumi.js";
import logger from "../utils/Logger.utils.js";
import AppError from "../utils/AppError.utils.js";
import { Agent } from 'undici';
import { formatDuration } from '../utils/Time.utils.js';
import type { VmInfo, CreateVMRequest } from '../types/compute.type.js';
import { createVm, deleteVm, findAll, update } from "../repositories/vm.repository.js";
import { VmStatus } from "../generated/prisma/browser.js";

export const CreateOrUpdateVm = async (vm: CreateVMRequest) => {

  const stack = await createOrSelectStack(String(vm.id));


  await stack.setConfig("vm:name", { value: vm.name });
  await stack.setConfig("vm:cpu", { value: String(vm.cpu) });
  await stack.setConfig("vm:memory", { value: String(vm.memory) })
  await stack.setConfig("vm:storage", { value: String(vm.storage) })
  await stack.setConfig("vm:id", { value: String(vm.id) })

  await stack.setConfig("vm:ioAddress", { value: vm.ioAddress });
  await stack.setConfig("vm:gateway", { value: vm.gateway });
  await stack.setConfig("vm:username", { value: vm.username });
  await stack.setConfig("vm:sshKey", { value: vm.sshKey });

  await stack.setConfig("vm:password", { value: vm.password });
  await stack.setConfig("vm:templateId", { value: vm.templateId });
  const id = crypto.randomUUID();

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
    // owner: null,
  }
  try {
    await createVm(conf)
    console.log("here i am after doing createVM")
    await stack.up({ onOutput: console.log })
    console.log("here i am after doing stack.up")
    await update(id, { status: VmStatus.completed })
    console.log("update done bhai")
  } catch (err) {
    console.log("error")
    // await update(id, { status: VmStatus.failed })
    logger.error(`error`, err)
  }
};

export const DestroyVm = async (vm: string) => {
  console.log(vm);

  try {
    const stack = await selectStack(String(vm));
    const vmName = stack.name;

    await stack.destroy({ onOutput: console.log });
    await stack.workspace.removeStack(vmName, { force: true, preserveConfig: false });
    await deleteVm(vm);
    logger.info(`Stack ${vmName} destroyed and removed`)
  } catch (error) {
    throw new AppError(`Stack not found: ${error}`, 500)
  }
}

export const ListVms = async () => {

  const nodeName = process.env.PROXMOX_NODE || "proxmox";
  const tokenId = process.env.PROXMOX_API_TOKEN_ID;
  const tokenSecret = process.env.PROXMOX_API_TOKEN_SECRET;
  const endpoint = process.env.PROXMOX_ENDPOINT;
  const sslVerify = process.env.PROXMOX_SSL_VERIFY?.toLowerCase() !== 'false';

  if (!sslVerify) {
    console.log("[LOG]: SSL verification is disabled via PROXMOX_VE_SSL_VERIFY=false. This is insecure and should only be used in Internal Networks.");
  }
  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: sslVerify,
    }
  })
  const headers = {
    method: 'GET',
    headers: {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },
    dispatcher: dispatcher,
  }
  try {
    const response = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/`, headers);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Proxmox API Error: ${response.status} ${response.statusText}. Details: ${errorBody}`);
    }

    const vmStatus = await response.json();
    let allVms: VmInfo[] = [];
    const vmData = vmStatus.data;
    // console.log(vmStatus)
    // console.log(vmData)

    for (let i = 0; i < vmData.length; i++) {
      if (vmData[i].template == 1) {
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
      })
    }

    const output = await findAll();
    // console.log("output gotten", output)
    let filteredOutput: VmInfo[] | any = [];

    for (let i = 0; i < output.length; i++) {
      for (let j = 0; j < allVms.length; j++) {
        if (output[i]?.vmId == allVms[j]?.vmId) {
          filteredOutput.push(allVms[j])
        }
      }
    }
    // console.log("ggs")
    return filteredOutput;

  } catch (error: any) {
    console.error("Error:", error); // Log the full error object
    throw new Error(`Error: ${error.message}. Is the Proxmox endpoint (${endpoint}) correct and reachable?`);
  }
};

export const GetVmState = async (vmId: string) => {

  const nodeName = process.env.PROXMOX_NODE || "proxmox";
  const tokenId = process.env.PROXMOX_API_TOKEN_ID;
  const tokenSecret = process.env.PROXMOX_API_TOKEN_SECRET;
  const endpoint = process.env.PROXMOX_ENDPOINT;
  const sslVerify = process.env.PROXMOX_SSL_VERIFY?.toLowerCase() !== 'false';

  if (!sslVerify) {
    console.log("[LOG]: SSL verification is disabled via PROXMOX_VE_SSL_VERIFY=false. This is insecure and should only be used in Internal Networks.");
  }


  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: sslVerify,
    }
  })

  const headers = {
    method: 'GET',
    headers: {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },
    dispatcher: dispatcher,
  }

  try {
    const response = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/${vmId}/status/current`, headers);

    if (!response.ok) {
      const errorBody = await response.text();
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
    }
    console.log(output)
    return { output };

  } catch (error: any) {
    console.error("Error:", error); // Log the full error object
    throw new Error(`Error: ${error.message}. Is the Proxmox endpoint (${endpoint}) correct and reachable?`);
  }
}

const selectStack = async (vmId: string) => {
  const stackName: string = `vm-${vmId}`;

  const args: InlineProgramArgs = {
    stackName,
    projectName: "provisioner-ts",
    program: PulumiProgram
  }

  const opts: LocalWorkspaceOptions = {
    workDir: '/home/sd/.pulumi'
  }
  try {
    const stack = await LocalWorkspace.selectStack(args, opts)
    return stack;
  } catch (error) {
    throw new Error(`Pulumi operation failed for stack ${stackName}. Reason: ${error}`)
  }
}

export const createOrSelectStack = async (vmId: string) => {
  const stackName = `vm-${vmId}`;

  const args: InlineProgramArgs = {
    stackName,
    projectName: 'provisioner-ts',
    program: PulumiProgram,
  }

  const opts: LocalWorkspaceOptions = {
    workDir: '/home/sd/.pulumi',
    // envVars: {
    //   PULUMI_BACKEND_URL: "s3://my-bucket-name?region=us-east-1&endpoint=http://minio:9000",
    //   AWS_ACCESS_KEY_ID: "minio-access-key",
    //   AWS_SECRET_ACCESS_KEY: "minio-secret-key"
    // }
  }

  try {
    const stack = await LocalWorkspace.createOrSelectStack(args, opts);
    logger.info(`Stack '${stackName}' selected successfully.`);
    return stack;
  } catch (error) {
    logger.error(`Failed to create or select stack '${stackName}': ${error}`);
    throw new AppError(`Pulumi operation failed for stack ${stackName}. Reason: ${error}`, 500);
  }
};

