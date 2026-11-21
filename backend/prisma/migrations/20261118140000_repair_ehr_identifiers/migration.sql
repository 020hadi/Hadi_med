BEGIN;

ALTER TYPE "MedicalRecordAccessActiON "
RENAME TO "MedicalRecordAccessAction";

ALTER TABLE "medical_record_access_logs"
RENAME COLUMN "actiON " TO "action";

ALTER TABLE "medical_record_access_logs"
RENAME COLUMN "reasON " TO "reason";

ALTER TABLE "clinical_encounters"
RENAME COLUMN "examinatiON " TO "examination";

ALTER TABLE "diagnoses"
RENAME COLUMN "descriptiON " TO "description";

ALTER TABLE "medical_conditions"
RENAME COLUMN "descriptiON " TO "description";

ALTER TABLE "medical_documents"
RENAME COLUMN "descriptiON " TO "description";

ALTER TABLE "patient_allergies"
RENAME COLUMN "reactiON " TO "reaction";

ALTER TABLE "prescription_items"
RENAME COLUMN "duratiON " TO "duration";

ALTER TABLE "vital_signs"
RENAME COLUMN "oxygenSaturatiON " TO "oxygenSaturation";

COMMIT;
