import * as pulumi from '@pulumi/pulumi'
import * as proxmox from '@muhlba91/pulumi-proxmoxve'
import { config } from "../config/index.js";

export const PulumiProxmoxProgram = async () => {
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
  const sshKey = vmConfig.require("sshKey") || "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILC1sojEzJi3s0pzFfOJ9gBuOlBeFRfSrrlonZmeGnwS shivam.d@alligatorinfosoft.com"
  const password = vmConfig.require("password");
  const bootOrder = ["ide2", "scsi0"]; // ide2 for cloud-init, scsi0 for OS

  const templateVmIdStr = vmConfig.require("templateId") || config.proxmox.templateId; const templateVmId = parseInt(templateVmIdStr, 10);
  const datastoreId = config.proxmox.datastoreId;


  const virtualMachine = new proxmox.vm.VirtualMachine(name, {

    vmId: id,
    name: name,
    nodeName: proxmoxNode,

    clone: {
      vmId: templateVmId,
      full: true,
    },

    tags: ['custom'],

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
      type: "nocloud",
      interface: "ide2",
      datastoreId: datastoreId,
      ipConfigs: [{
        ipv4: {
          address: ipAddress,
          gateway: gateway,
        },
      }],
      dns: {
        servers: ["1.1.1.1", "8.8.8.8"],
        domain: "example.local",
      },
      userAccount: {
        username: username,
        password: password,
        keys: [sshKey],
      },
    },
  }, {
    provider: proxmoxProvider,
    ignoreChanges: ["initialization", "bootOrders", "disks"],
  });
  return {
    vmId: virtualMachine.id,
    vmName: virtualMachine.name,
  }
}

