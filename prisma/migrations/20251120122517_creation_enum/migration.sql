/*
  Warnings:

  - The `status` column on the `VM` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "VmCreationStatus" AS ENUM ('pending', 'creating', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "VmRuntimeStatus" AS ENUM ('running', 'stopped', 'crashed', 'stopping', 'unknown');

-- AlterTable
ALTER TABLE "VM" ADD COLUMN     "runtimeStatus" "VmRuntimeStatus" NOT NULL DEFAULT 'stopped',
DROP COLUMN "status",
ADD COLUMN     "status" "VmCreationStatus" NOT NULL DEFAULT 'pending';

-- DropEnum
DROP TYPE "VmStatus";
