import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os'
dotenv.config({ quiet: true });

const pulumiDir: string = os.tmpdir() + "/.pulumi";
if (!fs.existsSync(pulumiDir)) {
  fs.mkdirSync(pulumiDir);
}

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    throw new Error (`Missing Required env var: ${key}`);
  }
  return value;
}

export const config = Object.freeze({
  port: process.env.PORT || '3000',

  proxmox: {
    endpoint: getEnv('PROXMOX_ENDPOINT'),
    node: getEnv('PROXMOX_NODE'),
    apiTokenId: getEnv('PROXMOX_API_TOKEN_ID'),
    apiTokenSecret: getEnv('PROXMOX_API_TOKEN_SECRET'),
    sslVerify: process.env.PROXMOX_SSL_VERIFY?.toLowerCase() != 'false',
    templateId: getEnv('PROXMOX_TEMPLATE_VM_ID'),
    datastoreId: getEnv('PROXMOX_DATASTORE_ID')
  },

  pulumi: {
    backendUrl: getEnv('PULUMI_BACKEND_URL'),
    accessKeyId: getEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: getEnv('AWS_SECRET_ACCESS_KEY'),
    region: getEnv('AWS_REGION'),
    workDir: pulumiDir,
    configPassphrase: getEnv('PULUMI_CONFIG_PASSPHRASE'),
  },

  log: process.env.LOG_LEVEL,
  env: process.env.NODE_ENV,
  dbUri: process.env.DATABASE_URL || "",
  advisoryLockId: Number(process.env.ADVISORY_LOCK_ID || "9876543210")
})
