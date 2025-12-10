/*
  Warnings:

  - The `uptime` column on the `VM` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "VM" DROP COLUMN "uptime",
ADD COLUMN     "uptime" BIGINT;
