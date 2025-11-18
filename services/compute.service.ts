import { LocalWorkspace, type InlineProgramArgs, type LocalWorkspaceOptions } from "@pulumi/pulumi/automation/localWorkspace.js";
import { PulumiProxmoxProgram as PulumiProgram } from "../pulumi/pulumi.js";
import logger from "../utils/Logger.utils.js";
import AppError from "../utils/AppError.utils.js";
import { Agent } from 'undici';
import { formatDuration } from '../utils/Time.utils.js';
import type { VmInfo, CreateVMRequest } from '../types/compute.type.js';

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

  return await stack.up({ onOutput: console.log })
};

export const DestroyVm = async (vm: string) => {
  console.log(vm);

  const stack = await selectStack(String(vm));
  const vmName = stack.name;

  await stack.destroy({ onOutput: console.log });
  await stack.workspace.removeStack(vmName, { force: true, preserveConfig: false });
  console.log(`Stack ${vmName} destroyed and removed`)
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
    let output: VmInfo[] = [];
    const vmData = vmStatus.data;
    // console.log(vmStatus)
    // console.log(vmData)

    for (let i = 0; i < vmData.length; i++) {
      if (vmData[i].template == 1) {
        continue;
      }
      const time = formatDuration(vmData[i].uptime);
      output.push({
        vmId: vmData[i].vmid,
        cpus: vmData[i].cpus,
        memory: vmData[i].mem,
        name: vmData[i].name,
        status: vmData[i].status,
        uptime: time,
      })
    }
    console.log(output);
    return output;

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

