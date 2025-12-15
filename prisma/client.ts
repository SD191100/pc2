import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { config } from "../src/config/index.js";

const connectionString = config.dbUri;
console.log('Database connection string:', connectionString);
console.log('Connection string type:', typeof connectionString);
console.log('Connection string length:', connectionString.length);

// Try to parse the connection string manually
try {
  const url = new URL(connectionString);
  console.log('Parsed URL - host:', url.host);
  console.log('Parsed URL - hostname:', url.hostname);
  console.log('Parsed URL - port:', url.port);
} catch (e) {
  console.error('Failed to parse URL:', e);
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export { prisma }
