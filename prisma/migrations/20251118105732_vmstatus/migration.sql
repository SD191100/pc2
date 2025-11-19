-- CreateEnum
CREATE TYPE "VmStatus" AS ENUM ('pending', 'creating', 'running', 'failed');

-- AlterTable
ALTER TABLE "VM" ADD COLUMN     "status" "VmStatus" NOT NULL DEFAULT 'pending';
