import { z } from 'zod';

/**
 * Validation schemas for test routes
 */

// Dispatch SMUR endpoint
export const dispatchSmurBodySchema = z.object({
  priority: z.enum(['P0', 'P1', 'P2']),
  location: z.string().min(1, 'Location is required'),
  reason: z.string().min(1, 'Reason is required'),
  patientPhone: z.string().optional(),
  callId: z.string().optional(),
});

// ABCD Analysis endpoint
export const analyzeAbcdBodySchema = z.object({
  symptoms: z.record(z.unknown()),
  abcdAssessment: z.record(z.unknown()).optional(),
});

// Record data endpoint
export const recordDataBodySchema = z.object({
  transcript: z.string().optional(),
  notes: z.string().optional(),
});

// Queue list query params
export const queueQuerySchema = z.object({
  status: z.enum(['WAITING', 'CLAIMED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED']).optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
});

// Queue claim params and body
export const queueClaimParamSchema = z.object({
  id: z.string().min(1, 'Queue entry ID is required'),
});

export const queueClaimBodySchema = z.object({
  operatorId: z.string().min(1, 'Operator ID is required'),
});

// Handoff request body
export const handoffRequestBodySchema = z.object({
  callId: z.string().min(1, 'Call ID is required'),
  toOperatorId: z.string().min(1, 'Operator ID is required'),
  reason: z.string().min(1, 'Reason is required'),
  conversationId: z.string().optional(),
  transcript: z.string().min(1, 'Transcript is required'),
  aiContext: z.any(),
  patientSummary: z.string().min(1, 'Patient summary is required'),
});

// Handoff accept param
export const handoffAcceptParamSchema = z.object({
  id: z.string().min(1, 'Handoff ID is required'),
});

// Take control params and body
export const takeControlParamSchema = z.object({
  callId: z.string().min(1, 'Call ID is required'),
});

export const takeControlBodySchema = z.object({
  operatorId: z.string().min(1, 'Operator ID is required'),
  reason: z.string().optional(),
});

// Map interventions query params
export const mapInterventionsQuerySchema = z.object({
  status: z
    .enum(['PENDING', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'COMPLETED', 'CANCELLED'])
    .optional(),
  priority: z.enum(['P0', 'P1', 'P2']).optional(),
  last_hours: z.coerce.number().positive().optional(),
});
