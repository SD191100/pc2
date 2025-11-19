import type { VmStatus } from "../generated/prisma/enums.js";

export interface VM {
  id: string;
  vmId: string;
  name: string;
  cpu: number ;
  memory: number;
  storage: number;
  ioAddress?: string | null;
  gateway?: string | null;
  username?: string | null;
  password?: string | null;
  templateId?: string | null;
  stackName: string;
  status: VmStatus;
  owner?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}
