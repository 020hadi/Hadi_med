/*
  Warnings:

  - A unique constraint covering the columns `[pendingPhone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "patientProfileId" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "pendingPhone" VARCHAR(30),
ADD COLUMN     "phoneVerifiedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "phone_verification_challenges" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "codeHash" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "resendAvailableAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verification_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_verification_challenges_userId_createdAt_idx" ON "phone_verification_challenges"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "phone_verification_challenges_phone_createdAt_idx" ON "phone_verification_challenges"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "phone_verification_challenges_expiresAt_idx" ON "phone_verification_challenges"("expiresAt");

-- CreateIndex
CREATE INDEX "appointments_patientProfileId_createdAt_idx" ON "appointments"("patientProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_pendingPhone_key" ON "users"("pendingPhone");

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_verification_challenges" ADD CONSTRAINT "phone_verification_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
