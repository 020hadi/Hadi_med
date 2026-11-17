-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CLINIC_MANAGER';

-- CreateTable
CREATE TABLE "organization_managers" (
    "id" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "assignedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_managers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_managers_organizationId_idx" ON "organization_managers"("organizationId");

-- CreateIndex
CREATE INDEX "organization_managers_managerId_idx" ON "organization_managers"("managerId");

-- CreateIndex
CREATE INDEX "organization_managers_assignedById_idx" ON "organization_managers"("assignedById");

-- CreateIndex
CREATE UNIQUE INDEX "organization_managers_managerId_organizationId_key" ON "organization_managers"("managerId", "organizationId");

-- AddForeignKey
ALTER TABLE "organization_managers" ADD CONSTRAINT "organization_managers_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_managers" ADD CONSTRAINT "organization_managers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_managers" ADD CONSTRAINT "organization_managers_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
