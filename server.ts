import { prisma } from './prisma/client.js';
import  server from './src/app.js'
import { config } from './src/config/index.js';
import logger from './src/utils/logger.utils.js';
import { FetchAllState } from './src/utils/state-fetcher.utils.js';

const PORT = config.port || 3000
const advisoryLockId = config.advisoryLockId;

setInterval(async () => {
  const lockResult: any[] = await prisma.$queryRaw`
    SELECT pg_try_advisory_lock(${advisoryLockId});
  `;

  const gotLock = lockResult?.[0]?.pg_try_advisory_lock;

  if (!gotLock) {
    logger.warn("FetchAllState skipped: previous run still in progress");
    return;
  }

  try {
    logger.info("FetchAllState: Starting Vm State retrieval", {
      advisoryLockId
    })
    await FetchAllState();
  } catch (error) {
    logger.error("FetchAllState error:", error);
  } finally {
    await prisma.$queryRaw`
      SELECT pg_advisory_unlock(${advisoryLockId});
    `;
    logger.info("FetchAllState: Vm State retrieval completed", {
      advisoryLockId
    })
  }
}, 45000);

server.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
