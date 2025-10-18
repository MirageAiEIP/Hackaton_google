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
