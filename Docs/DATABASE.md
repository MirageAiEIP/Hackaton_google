# Database Schema Documentation

## Overview

The SAMU AI Triage System uses PostgreSQL with the pgvector extension for vector similarity search in medical knowledge retrieval.

## Enums

### PriorityLevel
Emergency priority classification levels:
- **P0**: Absolute emergency (cardiac arrest)
- **P1**: Life-threatening emergency (severe respiratory distress)
- **P2**: Urgent (severe trauma)
- **P3**: Non-urgent (moderate symptoms)
- **P4**: Medical advice needed
- **P5**: Refer to general practitioner

### CallStatus
- **IN_PROGRESS**: Call is currently active
- **COMPLETED**: Call finished successfully
- **ESCALATED**: Call transferred to human operator
- **CANCELLED**: Call was cancelled
- **FAILED**: Call failed due to technical issues

### ABCDStatus
Assessment status for ABCD protocol:
- **NORMAL**: No issues detected
- **COMPROMISED**: Some concerns present
- **CRITICAL**: Immediate attention required
- **UNKNOWN**: Unable to assess

### ConsciousnessLevel
AVPU scale for consciousness assessment:
- **ALERT**: Patient is fully conscious and responsive
- **VERBAL**: Responds to verbal stimuli only
- **PAIN**: Responds to painful stimuli only
- **UNRESPONSIVE**: No response to any stimuli

### SeverityLevel
- **MILD**: Minor symptoms
- **MODERATE**: Moderate symptoms requiring attention
- **SEVERE**: Serious symptoms requiring urgent care

### RecommendedAction
AI recommendation for next steps:
- **IMMEDIATE_DISPATCH**: Send SMUR (emergency medical team) immediately
- **PRIORITY_CALLBACK**: Priority callback from medical staff
- **SCHEDULED_APPOINTMENT**: Schedule regular appointment
- **TELEHEALTH**: Handle via telemedicine
- **SELF_CARE**: Patient can manage with self-care advice

## Models

### Call
Represents an emergency call session.

**Key Fields**:
- `duration`: Call duration in seconds
- `transcript`: Full conversation transcript
- `audioRecordingUrl`: Link to audio recording
- `agentVersion`: AI agent version used
- `modelUsed`: LLM model identifier
- `processingTime`: Time to process call in milliseconds
- `qualityScore`: Quality score from 0 to 1

**Relations**:
- One Patient (optional)
- One TriageReport (optional)
- Many Symptoms
- Many RedFlags

### Patient
Stores anonymized patient information.

**Privacy**:
- Phone numbers are hashed (never stored in clear text)
- All PII is encrypted at database level

**Key Fields**:
- `phoneHash`: Hashed phone number (unique identifier)
- `locationPrecision`: "exact" | "approximate" | "unknown"
- `allergies`: Array of known allergies
- `medications`: Current medications
- `chronicConditions`: Chronic medical conditions
- `recentSurgery`: Boolean flag
- `pregnancy`: Boolean flag

### TriageReport
Complete medical triage assessment following ABCD protocol.

**ABCD Assessment**:
- **Airway**: Status and details
- **Breathing**: Status, rate (respirations/min), details
- **Circulation**: Status, chest pain flag, bleeding level, details
- **Consciousness**: AVPU level and details

**Priority Classification**:
- `priorityLevel`: P0-P5 enum
- `priorityScore`: Numeric score 0-100
- `confidence`: AI confidence level 0-1
- `reasoning`: Explanation of classification

**AI Recommendation**:
- `recommendedAction`: Suggested action enum
- `recommendationReasoning`: Explanation
- `recommendationConfidence`: Confidence level 0-1

**Summary**:
- `chiefComplaint`: Main reason for call
- `conversationSummary`: AI-generated summary
- `keyQuotes`: Important quotes from conversation

### Symptom
Individual symptoms reported during call.

**Fields**:
- `name`: Symptom description
- `severity`: MILD | MODERATE | SEVERE
- `onset`: When it started (e.g., "2 hours ago")
- `evolution`: "stable" | "improving" | "worsening"
- `details`: Additional context

### RedFlag
Critical warning signs detected by AI.

**Fields**:
- `flag`: Description of warning sign
- `severity`: "warning" | "critical"
- `detectedAt`: When it was identified

### MedicalKnowledge
RAG (Retrieval-Augmented Generation) knowledge base.

**Categories**:
- `protocol`: Medical protocols (e.g., ABCD triage)
- `symptom`: Symptom definitions
- `emergency_sign`: Critical emergency indicators

**Vector Search**:
- `embedding`: 1536-dimension vector for semantic similarity search
- Uses pgvector extension for efficient retrieval

**Verification**:
- `verified`: Boolean flag (must be validated by medical professional)
- `verifiedBy`: Medical professional who verified
- `verifiedAt`: Timestamp of verification

### AuditLog
GDPR/compliance audit trail.

**Purpose**: Track all database modifications for regulatory compliance.

**Fields**:
- `action`: Type of action performed
- `entityType`: Type of entity modified
- `entityId`: ID of modified entity
- `userId`: User who performed action
- `changes`: JSON diff of changes
- `metadata`: Additional context
- `ipAddress`: Source IP
- `userAgent`: Client user agent

## Indexes

Performance-critical indexes:

**Call**:
- `status` - Filter active calls
- `createdAt` - Sort by recency
- `patientId` - Join with patients

**Patient**:
- `phoneHash` - Unique lookup

**TriageReport**:
- `priorityLevel` - Filter by urgency
- `createdAt` - Sort by recency

**Symptom/RedFlag**:
- `callId` - Join with calls
- `severity` (RedFlag only) - Filter critical flags

**MedicalKnowledge**:
- `category` - Filter by knowledge type

**AuditLog**:
- `(entityType, entityId)` - Composite for entity history
- `userId` - Filter by user
- `createdAt` - Time-based queries

## Migrations

Run migrations:
```bash
npm run db:migrate
```

Generate Prisma Client:
```bash
npm run db:generate
```

Seed database:
```bash
npm run db:seed
```
