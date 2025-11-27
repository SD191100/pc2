import { Agent } from "undici";
import { config } from "../config/index.js";
import logger from "./logger.utils.js";

export const ProxmoxApi = async (method: string, apiEndpoint: string) => {
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
    method: method,
    headers: {
      'Authorization': `PVEAPIToken=${tokenId}=${tokenSecret}`,
    },
    dispatcher
  }

  const res = await fetch( `${endpoint}/api2/json/nodes/${nodeName}/${apiEndpoint}` , headers);

  return res;
}