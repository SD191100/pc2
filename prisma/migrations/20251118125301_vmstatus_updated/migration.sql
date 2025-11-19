/*
  Warnings:

  - The values [running] on the enum `VmStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "VmStatus_new" AS ENUM ('pending', 'creating', 'completed', 'failed');
ALTER TABLE "public"."VM" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "VM" ALTER COLUMN "status" TYPE "VmStatus_new" USING ("status"::text::"VmStatus_new");
ALTER TYPE "VmStatus" RENAME TO "VmStatus_old";
ALTER TYPE "VmStatus_new" RENAME TO "VmStatus";
DROP TYPE "public"."VmStatus_old";
ALTER TABLE "VM" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;
