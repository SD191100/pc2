export type CreateVMRequest = {
  id: number,
  name: string,
  cpu: number,
  memory: number;
  storage: number;
  ioAddress: string;
  gateway: string;
  username: string;
  password: string;
  sshKey: string;
  templateId: string;
};

export interface VmInfo {
  vmId: number;
  cpus: number;
  memory: number;
  name: string;
  status: string;
  uptime: string;
}
