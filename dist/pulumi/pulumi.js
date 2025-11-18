import * as proxmox from '@muhlba91/pulumi-proxmoxve';
import * as pulumi from '@pulumi/pulumi';
import { LocalWorkspace } from "@pulumi/pulumi/automation/localWorkspace.js";
import { config } from "../config/index.js";
import { Agent } from 'undici';
export const createVm = async (vm) => {
    console.log(vm);
    // 1. Define the Pulumi program.
    // 2. Create or select the stack.
    const stack = await createOrSelectStack(String(vm.id));
    // 3. Set stack configuration and secrets.
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
    // 4. Run `pulumi up` to create or update the infrastructure.
    // 5. Return the stack outputs.
    return await stack.up({ onOutput: console.log });
};
export const destroyVm = async (vm) => {
    console.log(vm);
    const stack = await selectStack(String(vm));
    const vmName = stack.name;
    await stack.destroy({ onOutput: console.log });
    await stack.workspace.removeStack(vmName);
    console.log(`Stack ${vmName} destroyed and removed`);
};
export const getVm = async (vmId) => {
    console.log(vmId);
    const vmID = Number(vmId);
    const args = {
        id: vmID,
        nodeName: "prox"
    };
    const vmResult = await proxmox.getVm2(args, { async: true });
    console.log("reached here");
    console.log(vmResult.id);
};
export function formatDuration(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0)
        parts.push(`${secs}s`);
    return parts.join(' ');
}
export const listVms = async () => {
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
    });
    const headers = {
        method: 'GET',
        headers: {
            'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
        },
        dispatcher: dispatcher,
    };
    try {
        const response = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/`, headers);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Proxmox API Error: ${response.status} ${response.statusText}. Details: ${errorBody}`);
        }
        const vmStatus = await response.json();
        let output = [];
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
            });
        }
        console.log(output);
        return output;
    }
    catch (error) {
        console.error("Error:", error); // Log the full error object
        throw new Error(`Error: ${error.message}. Is the Proxmox endpoint (${endpoint}) correct and reachable?`);
    }
};
export const getVmState = async (vmId) => {
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
    });
    const headers = {
        method: 'GET',
        headers: {
            'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
        },
        dispatcher: dispatcher,
    };
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
        };
        console.log(output);
        return { output };
    }
    catch (error) {
        console.error("Error:", error); // Log the full error object
        throw new Error(`Error: ${error.message}. Is the Proxmox endpoint (${endpoint}) correct and reachable?`);
    }
};
const selectStack = async (vmId) => {
    const stackName = `vm-${vmId}`;
    const args = {
        stackName,
        projectName: "provisioner-ts",
        program: pulumiProgram
    };
    const opts = {
        workDir: '/home/sd/.pulumi'
    };
    try {
        const stack = await LocalWorkspace.selectStack(args, opts);
        return stack;
    }
    catch (error) {
        throw new Error(`Pulumi operation failed for stack ${stackName}. Reason: ${error}`);
    }
};
export const createOrSelectStack = async (vmId) => {
    const stackName = `vm-${vmId}`;
    const args = {
        stackName,
        projectName: 'provisioner-ts',
        program: pulumiProgram,
    };
    const opts = {
        workDir: '/home/sd/.pulumi',
        // envVars: {
        //   PULUMI_BACKEND_URL: "s3://my-bucket-name?region=us-east-1&endpoint=http://minio:9000",
        //   AWS_ACCESS_KEY_ID: "minio-access-key",
        //   AWS_SECRET_ACCESS_KEY: "minio-secret-key"
        // }
    };
    try {
        const stack = await LocalWorkspace.createOrSelectStack(args, opts);
        // logger.info(`Stack '${stackName}' selected successfully.`);
        return stack;
    }
    catch (error) {
        // logger.error(`Failed to create or select stack '${stackName}': ${error}`);
        // throw new AppError(`Pulumi operation failed for stack ${stackName}. Reason: ${error}`, 500);
        throw error;
    }
};
const pulumiProgram = async () => {
    const endpoint = config.proxmox.endpoint;
    const apiTokenId = config.proxmox.apiTokenId;
    const apiTokenSecret = config.proxmox.apiTokenSecret;
    const proxmoxNode = config.proxmox.node;
    const proxmoxProvider = new proxmox.Provider("proxmox-provider", {
        endpoint: endpoint,
        apiToken: `${apiTokenId}=${apiTokenSecret}`,
        insecure: true,
    });
    const vmConfig = new pulumi.Config("vm");
    const id = vmConfig.requireNumber("id");
    const storage = vmConfig.requireNumber("storage");
    const name = vmConfig.require("name");
    const cpuCores = vmConfig.requireNumber("cpu");
    const memoryDedicated = vmConfig.requireNumber("memory");
    const ipAddress = vmConfig.require("ioAddress");
    const gateway = vmConfig.require("gateway");
    const username = vmConfig.require("username");
    const sshKey = vmConfig.require("sshKey") || "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILC1sojEzJi3s0pzFfOJ9gBuOlBeFRfSrrlonZmeGnwS shivam.d@alligatorinfosoft.com";
    const password = vmConfig.require("password");
    const bootOrder = ["ide2"];
    const templateVmIdStr = vmConfig.require("templateId") || config.proxmox.templateId;
    const templateVmId = parseInt(templateVmIdStr, 10);
    const datastoreId = config.proxmox.datastoreId;
    const virtualMachine = new proxmox.vm.VirtualMachine(name, {
        vmId: id,
        name: name,
        nodeName: proxmoxNode,
        clone: {
            vmId: templateVmId,
            full: true,
        },
        cpu: {
            cores: cpuCores || 2,
            sockets: 1,
        },
        memory: {
            dedicated: memoryDedicated,
        },
        disks: [{
                interface: "scsi0",
                datastoreId: datastoreId,
                size: storage || 20,
            }],
        networkDevices: [{
                bridge: "vmbr0",
                model: "virtio",
            }],
        onBoot: true,
        agent: {
            enabled: true,
            trim: true,
        },
        bootOrders: bootOrder,
        initialization: {
            // type: "nocloud",
            // interface: "ide2",
            // datastoreId: datastoreId,
            // userDataFileId: cloudInitFile.id,
            // networkDataFileId: networkConfigFile.id,
            //
            //
            type: "configdrive2", // ensure it's cloud-init
            datastoreId: datastoreId, // where the cloud-init disk lives
            // IP configuration
            ipConfigs: [{
                    ipv4: {
                        address: ipAddress, // static IP
                        gateway: gateway,
                    },
                }],
            // DNS configuration
            dns: {
                servers: ["1.1.1.1", "8.8.8.8"],
                domain: "example.local",
            },
            // User account
            userAccount: {
                username: username,
                password: password, // optional if using SSH keys only
                keys: [
                    sshKey, // your public key
                ],
            },
        },
    }, { provider: proxmoxProvider });
    return {
        vmId: virtualMachine.id,
        vmName: virtualMachine.name,
    };
};
//# sourceMappingURL=pulumi.js.map