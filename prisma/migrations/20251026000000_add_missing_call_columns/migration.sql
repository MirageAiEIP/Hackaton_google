-- Add missing columns to calls table
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "priority" "PriorityLevel";
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "priorityReason" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "chiefComplaint" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "currentSymptoms" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "vitalSigns" JSONB;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "contextInfo" JSONB;

-- Remove P4 and P5 from PriorityLevel enum
-- First, update any P4/P5 values to P3 (fallback)
UPDATE "triage_reports" SET "priorityLevel" = 'P3' WHERE "priorityLevel" IN ('P4', 'P5');
UPDATE "dispatches" SET "priority" = 'P3' WHERE "priority" IN ('P4', 'P5');
UPDATE "queue_entries" SET "priority" = 'P3' WHERE "priority" IN ('P4', 'P5');
UPDATE "calls" SET "priority" = 'P3' WHERE "priority" IN ('P4', 'P5');

-- Now change the enum type
ALTER TYPE "PriorityLevel" RENAME TO "PriorityLevel_old";
CREATE TYPE "PriorityLevel" AS ENUM ('P0', 'P1', 'P2', 'P3');
ALTER TABLE "triage_reports" ALTER COLUMN "priorityLevel" TYPE "PriorityLevel" USING "priorityLevel"::text::"PriorityLevel";
ALTER TABLE "dispatches" ALTER COLUMN "priority" TYPE "PriorityLevel" USING "priority"::text::"PriorityLevel";
ALTER TABLE "queue_entries" ALTER COLUMN "priority" TYPE "PriorityLevel" USING "priority"::text::"PriorityLevel";

-- Only alter calls.priority if it exists and is not null
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'calls' AND column_name = 'priority') THEN
    ALTER TABLE "calls" ALTER COLUMN "priority" TYPE "PriorityLevel" USING "priority"::text::"PriorityLevel";
  END IF;
END $$;

DROP TYPE "PriorityLevel_old";
