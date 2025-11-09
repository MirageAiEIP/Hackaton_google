-- ========================================
-- SAMU AI Triage - Database Initialization
-- ========================================
-- Execute this script in Supabase SQL Editor
--
-- For STAGING schema:
--   SET search_path TO staging;
--   (then run all commands below)
--
-- For PRODUCTION schema:
--   SET search_path TO production;
--   (then run all commands below)
-- ========================================


-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "PriorityLevel" AS ENUM ('P0', 'P1', 'P2', 'P3', 'P4', 'P5');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ESCALATED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ABCDStatus" AS ENUM ('NORMAL', 'COMPROMISED', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ConsciousnessLevel" AS ENUM ('ALERT', 'VERBAL', 'PAIN', 'UNRESPONSIVE');

-- CreateEnum
CREATE TYPE "SeverityLevel" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "RecommendedAction" AS ENUM ('IMMEDIATE_DISPATCH', 'PRIORITY_CALLBACK', 'SCHEDULED_APPOINTMENT', 'TELEHEALTH', 'SELF_CARE');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('PENDING', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('WAITING', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER DEFAULT 0,
    "status" "CallStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "patientId" TEXT,
    "transcript" TEXT,
    "audioRecordingUrl" TEXT,
    "agentVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "modelUsed" TEXT NOT NULL DEFAULT 'claude-3-5-sonnet',
    "processingTime" INTEGER,
    "qualityScore" DOUBLE PRECISION,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationPrecision" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "medications" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chronicConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recentSurgery" BOOLEAN NOT NULL DEFAULT false,
    "pregnancy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triage_reports" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "priorityLevel" "PriorityLevel" NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "airwayStatus" "ABCDStatus" NOT NULL,
    "airwayDetails" TEXT NOT NULL,
    "breathingStatus" "ABCDStatus" NOT NULL,
    "breathingRate" INTEGER,
    "breathingDetails" TEXT NOT NULL,
    "circulationStatus" "ABCDStatus" NOT NULL,
    "chestPain" BOOLEAN NOT NULL DEFAULT false,
    "bleeding" TEXT,
    "circulationDetails" TEXT NOT NULL,
    "consciousnessLevel" "ConsciousnessLevel" NOT NULL,
    "consciousnessDetails" TEXT NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "recommendedAction" "RecommendedAction" NOT NULL,
    "recommendationReasoning" TEXT NOT NULL,
    "recommendationConfidence" DOUBLE PRECISION NOT NULL,
    "conversationSummary" TEXT NOT NULL,
    "keyQuotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "triage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" "SeverityLevel" NOT NULL,
    "onset" TEXT NOT NULL,
    "evolution" TEXT NOT NULL,
    "details" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "red_flags" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "flag" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "red_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_knowledge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "embedding" vector(1536),
    "source" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "changes" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatches" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "priority" "PriorityLevel" NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "symptoms" TEXT NOT NULL,
    "patientPhone" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "DispatchStatus" NOT NULL DEFAULT 'PENDING',
    "responseTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_entries" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "priority" "PriorityLevel" NOT NULL,
    "chiefComplaint" TEXT NOT NULL,
    "patientAge" INTEGER,
    "patientGender" TEXT,
    "location" TEXT,
    "aiSummary" TEXT NOT NULL,
    "aiRecommendation" TEXT NOT NULL,
    "keySymptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "QueueStatus" NOT NULL DEFAULT 'WAITING',
    "waitingSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "estimatedWaitTime" INTEGER,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoffs" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "fromAgent" BOOLEAN NOT NULL DEFAULT true,
    "toOperatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "conversationId" TEXT,
    "transcript" TEXT NOT NULL,
    "aiContext" JSONB NOT NULL,
    "patientSummary" TEXT NOT NULL,
    "status" "HandoffStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "handoffDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elevenlabs_conversations" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "callId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "transcript" JSONB NOT NULL,
    "toolCalls" JSONB NOT NULL,
    "metadata" JSONB,
    "status" TEXT NOT NULL,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "audioUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elevenlabs_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_createdAt_idx" ON "calls"("createdAt");

-- CreateIndex
CREATE INDEX "calls_patientId_idx" ON "calls"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_phoneHash_key" ON "patients"("phoneHash");

-- CreateIndex
CREATE INDEX "patients_phoneHash_idx" ON "patients"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "triage_reports_callId_key" ON "triage_reports"("callId");

-- CreateIndex
CREATE INDEX "triage_reports_priorityLevel_idx" ON "triage_reports"("priorityLevel");

-- CreateIndex
CREATE INDEX "triage_reports_createdAt_idx" ON "triage_reports"("createdAt");

-- CreateIndex
CREATE INDEX "symptoms_callId_idx" ON "symptoms"("callId");

-- CreateIndex
CREATE INDEX "red_flags_callId_idx" ON "red_flags"("callId");

-- CreateIndex
CREATE INDEX "red_flags_severity_idx" ON "red_flags"("severity");

-- CreateIndex
CREATE INDEX "medical_knowledge_category_idx" ON "medical_knowledge"("category");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_callId_key" ON "dispatches"("callId");

-- CreateIndex
CREATE UNIQUE INDEX "dispatches_dispatchId_key" ON "dispatches"("dispatchId");

-- CreateIndex
CREATE INDEX "dispatches_callId_idx" ON "dispatches"("callId");

-- CreateIndex
CREATE INDEX "dispatches_status_idx" ON "dispatches"("status");

-- CreateIndex
CREATE INDEX "dispatches_requestedAt_idx" ON "dispatches"("requestedAt");

-- CreateIndex
CREATE INDEX "dispatches_latitude_longitude_idx" ON "dispatches"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "queue_entries_callId_key" ON "queue_entries"("callId");

-- CreateIndex
CREATE INDEX "queue_entries_status_idx" ON "queue_entries"("status");

-- CreateIndex
CREATE INDEX "queue_entries_priority_idx" ON "queue_entries"("priority");

-- CreateIndex
CREATE INDEX "queue_entries_waitingSince_idx" ON "queue_entries"("waitingSince");

-- CreateIndex
CREATE INDEX "queue_entries_claimedBy_idx" ON "queue_entries"("claimedBy");

-- CreateIndex
CREATE INDEX "handoffs_callId_idx" ON "handoffs"("callId");

-- CreateIndex
CREATE INDEX "handoffs_status_idx" ON "handoffs"("status");

-- CreateIndex
CREATE INDEX "handoffs_toOperatorId_idx" ON "handoffs"("toOperatorId");

-- CreateIndex
CREATE INDEX "handoffs_requestedAt_idx" ON "handoffs"("requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "elevenlabs_conversations_conversationId_key" ON "elevenlabs_conversations"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "elevenlabs_conversations_callId_key" ON "elevenlabs_conversations"("callId");

-- CreateIndex
CREATE INDEX "elevenlabs_conversations_conversationId_idx" ON "elevenlabs_conversations"("conversationId");

-- CreateIndex
CREATE INDEX "elevenlabs_conversations_agentId_idx" ON "elevenlabs_conversations"("agentId");

-- CreateIndex
CREATE INDEX "elevenlabs_conversations_callId_idx" ON "elevenlabs_conversations"("callId");

-- CreateIndex
CREATE INDEX "elevenlabs_conversations_status_idx" ON "elevenlabs_conversations"("status");

-- CreateIndex
CREATE INDEX "elevenlabs_conversations_startTime_idx" ON "elevenlabs_conversations"("startTime");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triage_reports" ADD CONSTRAINT "triage_reports_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "red_flags" ADD CONSTRAINT "red_flags_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elevenlabs_conversations" ADD CONSTRAINT "elevenlabs_conversations_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- CreateEnum
CREATE TYPE "OperatorStatus" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "status" "OperatorStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "totalCallsHandled" INTEGER NOT NULL DEFAULT 0,
    "averageHandleTime" INTEGER NOT NULL DEFAULT 0,
    "currentCallId" TEXT,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operators_email_key" ON "operators"("email");

-- CreateIndex
CREATE INDEX "operators_status_idx" ON "operators"("status");

-- CreateIndex
CREATE INDEX "operators_email_idx" ON "operators"("email");
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OPERATOR', 'ADMIN');

-- AlterEnum
ALTER TYPE "OperatorStatus" ADD VALUE 'ON_BREAK';

-- AlterTable
ALTER TABLE "handoffs" ALTER COLUMN "toOperatorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "operatorId" TEXT,
    "createdBy" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_operatorId_key" ON "users"("operatorId");

-- CreateIndex
CREATE INDEX "users_employeeId_idx" ON "users"("employeeId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_createdBy_idx" ON "users"("createdBy");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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
-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RETURNING', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "AmbulanceType" AS ENUM ('SMUR', 'AMBULANCE', 'VSAV', 'MEDICALISED');

-- AlterTable
ALTER TABLE "dispatches" ADD COLUMN     "ambulanceId" TEXT,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "estimatedArrivalMinutes" INTEGER;

-- CreateTable
CREATE TABLE "hospitals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "totalAmbulances" INTEGER NOT NULL DEFAULT 0,
    "availableAmbulances" INTEGER NOT NULL DEFAULT 0,
    "hasSMUR" BOOLEAN NOT NULL DEFAULT false,
    "hasEmergencyRoom" BOOLEAN NOT NULL DEFAULT true,
    "hasHelicopterPad" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT NOT NULL,
    "emergencyContact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "callSign" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "type" "AmbulanceType" NOT NULL,
    "hasDoctor" BOOLEAN NOT NULL DEFAULT false,
    "hasParamedic" BOOLEAN NOT NULL DEFAULT true,
    "hasAdvancedEquipment" BOOLEAN NOT NULL DEFAULT false,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLatitude" DOUBLE PRECISION NOT NULL,
    "currentLongitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION DEFAULT 0,
    "speed" DOUBLE PRECISION DEFAULT 0,
    "homeHospitalId" TEXT NOT NULL,
    "currentDispatchId" TEXT,
    "crewSize" INTEGER NOT NULL DEFAULT 2,
    "crewNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "driverName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastServiceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambulance_locations" (
    "id" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "status" "AmbulanceStatus" NOT NULL,
    "dispatchId" TEXT,
    "distanceToTarget" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambulance_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_code_key" ON "hospitals"("code");

-- CreateIndex
CREATE INDEX "hospitals_latitude_longitude_idx" ON "hospitals"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "hospitals_isActive_idx" ON "hospitals"("isActive");

-- CreateIndex
CREATE INDEX "hospitals_city_idx" ON "hospitals"("city");

-- CreateIndex
CREATE UNIQUE INDEX "ambulances_vehicleId_key" ON "ambulances"("vehicleId");

-- CreateIndex
CREATE INDEX "ambulances_status_idx" ON "ambulances"("status");

-- CreateIndex
CREATE INDEX "ambulances_homeHospitalId_idx" ON "ambulances"("homeHospitalId");

-- CreateIndex
CREATE INDEX "ambulances_currentLatitude_currentLongitude_idx" ON "ambulances"("currentLatitude", "currentLongitude");

-- CreateIndex
CREATE INDEX "ambulances_type_idx" ON "ambulances"("type");

-- CreateIndex
CREATE INDEX "ambulance_locations_ambulanceId_idx" ON "ambulance_locations"("ambulanceId");

-- CreateIndex
CREATE INDEX "ambulance_locations_recordedAt_idx" ON "ambulance_locations"("recordedAt");

-- CreateIndex
CREATE INDEX "ambulance_locations_dispatchId_idx" ON "ambulance_locations"("dispatchId");

-- CreateIndex
CREATE INDEX "calls_priority_idx" ON "calls"("priority");

-- CreateIndex
CREATE INDEX "dispatches_ambulanceId_idx" ON "dispatches"("ambulanceId");

-- AddForeignKey
ALTER TABLE "dispatches" ADD CONSTRAINT "dispatches_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_homeHospitalId_fkey" FOREIGN KEY ("homeHospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ambulance_locations" ADD CONSTRAINT "ambulance_locations_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
