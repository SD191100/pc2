import { Agent, fetch } from "undici";
import { config } from "../config/index.js";
import logger from "./logger.utils.js"
import AppError from "./app-error.utils.js";
import { FindAllVms, UpdateVmRecord } from "../repositories/vm.repository.js";
import type { VM } from "../generated/prisma/client.js";


export const FetchAllState = async () => {
  logger.debug("FetchAllState: Starting Vm State retrieval");
  const nodeName = config.proxmox.node || "proxmox";
  const tokenId = config.proxmox.apiTokenId;
  const tokenSecret = config.proxmox.apiTokenSecret;
  const endpoint = config.proxmox.endpoint;
  const sslVerify = String(config.proxmox.sslVerify)?.toLowerCase() !== 'false';

  if (!sslVerify) {
    logger.warn("FetchAllState: SSL/TLS verification is disabled - insecure configuration");
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
    dispatcher
  }

  const res = await fetch(`${endpoint}/api2/json/nodes/${nodeName}/qemu/`, headers);

  if (!res.ok) {
    const errorBody = await res.text();
    logger.error("FetchAllState: Proxmox API error", {
      status: res.status,
      statusText: res.statusText,
      errorBody
    });
    throw new AppError(`Proxmox API Error: ${res.status} ${res.statusText}. Details: ${errorBody}`, res.status)
  }

  const vmStatuses: any = await res.json();

  const vmRepo: VM[] | any = await FindAllVms();

  for (let i = 0; i < vmRepo.length; i++) {
    for (let j = 0; j < vmStatuses.data.length; j++) {
      if (vmRepo[i].vmId === String(vmStatuses.data[j].vmid)) {
        await UpdateVmRecord(vmRepo[i].id, { runtimeStatus: vmStatuses.data[j].status });
      }
    }
  }
}
