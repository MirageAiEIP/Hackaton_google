-- Add missing columns to calls table (skip priority, it was just added)
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "priorityReason" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "chiefComplaint" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "currentSymptoms" TEXT;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "vitalSigns" JSONB;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "contextInfo" JSONB;

-- Remove P4 and P5 from PriorityLevel enum
ALTER TYPE "PriorityLevel" RENAME TO "PriorityLevel_old";
CREATE TYPE "PriorityLevel" AS ENUM ('P0', 'P1', 'P2', 'P3');
ALTER TABLE "triage_reports" ALTER COLUMN "priorityLevel" TYPE "PriorityLevel" USING "priorityLevel"::text::"PriorityLevel";
ALTER TABLE "dispatches" ALTER COLUMN "priority" TYPE "PriorityLevel" USING "priority"::text::"PriorityLevel";
ALTER TABLE "queue_entries" ALTER COLUMN "priority" TYPE "PriorityLevel" USING "priority"::text::"PriorityLevel";
ALTER TABLE "calls" ALTER COLUMN "priority" TYPE "PriorityLevel" USING "priority"::text::"PriorityLevel";
DROP TYPE "PriorityLevel_old";
