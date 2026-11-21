-- CreateEnum
CREATE TYPE "MedicalRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EncounterStatus" AS ENUM ('DRAFT', 'SIGNED', 'AMENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiagnosisType" AS ENUM ('PRIMARY', 'SECONDARY', 'DIFFERENTIAL');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MedicalConsentStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MedicalRecordAccessActiON " AS ENUM ('VIEW', 'CREATE', 'UPDATE', 'SIGN', 'DOWNLOAD', 'CONSENT_GRANTED', 'CONSENT_REVOKED');

-- CreateTable
CREATE TABLE "medical_records" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "status" "MedicalRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_encounters" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "appointmentId" UUID,
    "status" "EncounterStatus" NOT NULL DEFAULT 'DRAFT',
    "chiefComplaint" TEXT,
    "history" TEXT,
    "examinatiON " TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "notes" TEXT,
    "signedAt" TIMESTAMPTZ(3),
    "authoredById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "clinical_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "code" VARCHAR(50),
    "system" VARCHAR(50),
    "title" VARCHAR(300) NOT NULL,
    "descriptiON " TEXT,
    "type" "DiagnosisType" NOT NULL DEFAULT 'SECONDARY',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescriptions" (
    "id" UUID NOT NULL,
    "encounterId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "issuedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_items" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "medicationName" VARCHAR(250) NOT NULL,
    "dosage" VARCHAR(120),
    "route" VARCHAR(100),
    "frequency" VARCHAR(150),
    "duratiON " VARCHAR(100),
    "quantity" VARCHAR(100),
    "instructions" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "prescription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_allergies" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "allergen" VARCHAR(250) NOT NULL,
    "reactiON " TEXT,
    "severity" "AllergySeverity" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "patient_allergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_conditions" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "code" VARCHAR(50),
    "descriptiON " TEXT,
    "diagnosedAt" DATE,
    "resolvedAt" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medical_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vital_signs" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "encounterId" UUID,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "temperatureC" DECIMAL(5,2),
    "oxygenSaturatiON " DECIMAL(5,2),
    "heightCm" DECIMAL(6,2),
    "weightKg" DECIMAL(6,2),
    "measuredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "encounterId" UUID,
    "testName" VARCHAR(250) NOT NULL,
    "testCode" VARCHAR(80),
    "value" VARCHAR(250),
    "unit" VARCHAR(50),
    "referenceRange" VARCHAR(150),
    "resultStatus" VARCHAR(80),
    "laboratory" VARCHAR(200),
    "performedAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_documents" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "category" VARCHAR(100),
    "descriptiON " TEXT,
    "checksum" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_record_consents" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "grantedById" UUID NOT NULL,
    "status" "MedicalConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "purpose" VARCHAR(500),
    "startsAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "medical_record_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_record_access_logs" (
    "id" UUID NOT NULL,
    "medicalRecordId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "actiON " "MedicalRecordAccessActiON " NOT NULL,
    "reasON " VARCHAR(500),
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medical_record_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medical_records_patientProfileId_key" ON "medical_records"("patientProfileId");

-- CreateIndex
CREATE INDEX "medical_records_status_createdAt_idx" ON "medical_records"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_encounters_appointmentId_key" ON "clinical_encounters"("appointmentId");

-- CreateIndex
CREATE INDEX "clinical_encounters_medicalRecordId_createdAt_idx" ON "clinical_encounters"("medicalRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "clinical_encounters_doctorId_createdAt_idx" ON "clinical_encounters"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "clinical_encounters_status_signedAt_idx" ON "clinical_encounters"("status", "signedAt");

-- CreateIndex
CREATE INDEX "diagnoses_encounterId_type_idx" ON "diagnoses"("encounterId", "type");

-- CreateIndex
CREATE INDEX "diagnoses_code_idx" ON "diagnoses"("code");

-- CreateIndex
CREATE INDEX "prescriptions_encounterId_status_idx" ON "prescriptions"("encounterId", "status");

-- CreateIndex
CREATE INDEX "prescriptions_doctorId_createdAt_idx" ON "prescriptions"("doctorId", "createdAt");

-- CreateIndex
CREATE INDEX "prescription_items_prescriptionId_idx" ON "prescription_items"("prescriptionId");

-- CreateIndex
CREATE INDEX "patient_allergies_patientProfileId_isActive_idx" ON "patient_allergies"("patientProfileId", "isActive");

-- CreateIndex
CREATE INDEX "medical_conditions_patientProfileId_isActive_idx" ON "medical_conditions"("patientProfileId", "isActive");

-- CreateIndex
CREATE INDEX "vital_signs_medicalRecordId_measuredAt_idx" ON "vital_signs"("medicalRecordId", "measuredAt");

-- CreateIndex
CREATE INDEX "vital_signs_encounterId_idx" ON "vital_signs"("encounterId");

-- CreateIndex
CREATE INDEX "lab_results_medicalRecordId_performedAt_idx" ON "lab_results"("medicalRecordId", "performedAt");

-- CreateIndex
CREATE INDEX "lab_results_encounterId_idx" ON "lab_results"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "medical_documents_storageKey_key" ON "medical_documents"("storageKey");

-- CreateIndex
CREATE INDEX "medical_documents_medicalRecordId_createdAt_idx" ON "medical_documents"("medicalRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "medical_record_consents_medicalRecordId_doctorId_status_idx" ON "medical_record_consents"("medicalRecordId", "doctorId", "status");

-- CreateIndex
CREATE INDEX "medical_record_consents_expiresAt_idx" ON "medical_record_consents"("expiresAt");

-- CreateIndex
CREATE INDEX "medical_record_access_logs_medicalRecordId_createdAt_idx" ON "medical_record_access_logs"("medicalRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "medical_record_access_logs_actorId_createdAt_idx" ON "medical_record_access_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_encounters" ADD CONSTRAINT "clinical_encounters_authoredById_fkey" FOREIGN KEY ("authoredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_items" ADD CONSTRAINT "prescription_items_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "prescriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_allergies" ADD CONSTRAINT "patient_allergies_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_conditions" ADD CONSTRAINT "medical_conditions_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "clinical_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_documents" ADD CONSTRAINT "medical_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record_consents" ADD CONSTRAINT "medical_record_consents_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record_consents" ADD CONSTRAINT "medical_record_consents_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record_consents" ADD CONSTRAINT "medical_record_consents_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record_access_logs" ADD CONSTRAINT "medical_record_access_logs_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_record_access_logs" ADD CONSTRAINT "medical_record_access_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
