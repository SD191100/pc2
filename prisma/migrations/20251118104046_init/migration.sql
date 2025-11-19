-- CreateTable
CREATE TABLE "VM" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpu" INTEGER NOT NULL,
    "memory" INTEGER NOT NULL,
    "storage" INTEGER NOT NULL,
    "ioAddress" TEXT,
    "gateway" TEXT,
    "username" TEXT,
    "password" TEXT,
    "templateId" TEXT,
    "stackName" TEXT NOT NULL,
    "owner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VM_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VM_vmId_key" ON "VM"("vmId");

-- CreateIndex
CREATE UNIQUE INDEX "VM_stackName_key" ON "VM"("stackName");
