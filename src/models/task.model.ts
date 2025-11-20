import type { taskStatus } from "../generated/prisma/enums.js";

export interface TASK {
  id: string;
  status: taskStatus;
  createdAt: Date;
  updatedAt: Date;
}
