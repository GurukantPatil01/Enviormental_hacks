import { z } from 'zod';

//
// SECURITY: role is deliberately NOT part of the public registration schema.
// Public signup always creates a RESIDENT account. Privileged roles
// (MAINTAINER, WARD_ADMIN, SUPER_ADMIN) can only be assigned through the
// authorized internal admin process (audited) — never self-selected.
//
export const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const joinCommunitySchema = z.object({
  communityId: z.string().uuid('Invalid community ID format'),
});

export type JoinCommunityInput = z.infer<typeof joinCommunitySchema>;

export const startMissionSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
});

export type StartMissionInput = z.infer<typeof startMissionSchema>;

export const completeMissionSchema = z.object({
  missionId: z.string().uuid('Invalid mission ID format'),
  client_event_id: z.string().min(8, 'Client event ID must be at least 8 characters for idempotency'),
  notes: z.string().max(500).optional(),
  evidenceUrl: z.string().url().optional(),
});

export type CompleteMissionInput = z.infer<typeof completeMissionSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ==========================================
// Report Validation
// ==========================================
export const reportCategoryEnum = z.enum([
  'WASTE_HOTSPOT',
  'ILLEGAL_DUMPING',
  'OVERFLOWING_BIN',
  'MISSED_COLLECTION',
  'MIXED_WASTE',
  'OTHER',
]);

export const createReportSchema = z.object({
  communityId: z.string().uuid('Invalid community ID format'),
  category: reportCategoryEnum,
  title: z.string().min(5, 'Title must be at least 5 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  locationAddress: z.string().max(300).optional(),
  locationGeoJson: z.record(z.unknown()).optional(),
  clientEventId: z.string().optional(),
  evidenceUrl: z.string().optional(), // optional initial photo
});

export type CreateReportInput = z.infer<typeof createReportSchema>;


export const submitReportSchema = z.object({
  client_event_id: z.string().optional(),
});

export type SubmitReportInput = z.infer<typeof submitReportSchema>;

export const addEvidenceSchema = z.object({
  mediaUrl: z.string().min(1, 'Media URL or payload is required'),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']).default('IMAGE'),
  locationGeoJson: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;

// ==========================================
// Review Validation
// ==========================================
export const reviewDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'REQUEST_MORE_EVIDENCE']),
  reason: z.string().max(1000).optional(),
});


export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

// ==========================================
// Task Validation
// ==========================================
export const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const createTaskSchema = z.object({
  communityId: z.string().uuid('Invalid community ID format'),
  reportId: z.string().uuid('Invalid report ID format').optional(),
  title: z.string().min(5, 'Title must be at least 5 characters').max(255),
  description: z.string().max(2000).optional(),
  priority: taskPriorityEnum.default('MEDIUM'),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const assignTaskSchema = z.object({
  assignedTo: z.string().uuid('Invalid user ID format'),
});

export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const completeTaskSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

export const verifyTaskSchema = z.object({
  verified: z.boolean(),
  notes: z.string().max(1000).optional(),
});

export type VerifyTaskInput = z.infer<typeof verifyTaskSchema>;

// ==========================================
// Rewards & Coupon Validation
// ==========================================
export const claimRewardSchema = z.object({
  clientEventId: z.string().min(8, 'Client event ID must be at least 8 characters for idempotency'),
});

export type ClaimRewardInput = z.infer<typeof claimRewardSchema>;

export const getRewardsQuerySchema = z.object({
  category: z.string().optional(),
});

export type GetRewardsQuery = z.infer<typeof getRewardsQuerySchema>;

// ==========================================
// Event & Environmental Intelligence Validation
// ==========================================
export const ecoPulseEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  version: z.number().int().positive().default(1),
  source: z.string().default('ecopulse.api'),
  timestamp: z.string(),
  correlationId: z.string(),
  payload: z.record(z.unknown()),
  actorId: z.string().nullable().optional(),
});

export type EcoPulseEventInput = z.infer<typeof ecoPulseEventSchema>;

export const environmentalObservationSchema = z.object({
  wasteType: z.string().min(1),
  secondaryWasteTypes: z.array(z.string()).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  confidence: z.number().min(0).max(1),
  estimatedVolume: z.string().optional(),
  environmentalRisk: z.string().optional(),
  publicSafetyRisk: z.string().optional(),
  illegalDumpingLikelihood: z.number().min(0).max(1).optional(),
  description: z.string().optional(),
  recommendedAction: z.string().optional(),
});

export type EnvironmentalObservationInput = z.infer<typeof environmentalObservationSchema>;

export const createInterventionSchema = z.object({
  hotspotId: z.string().uuid('Invalid hotspot UUID'),
  type: z.enum([
    'CLEANUP_CREW',
    'ADD_BIN',
    'COMMUNITY_DRIVE',
    'SURVEILLANCE_CAMERA',
    'ENFORCEMENT_FINE',
    'DRAIN_DESILTING',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  assignedTeam: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateInterventionInput = z.infer<typeof createInterventionSchema>;

// ==========================================
// Gemini Structured Vision Analysis Validation
// ==========================================
export const geminiVisionAnalysisSchema = z.object({
  wasteDetected: z.boolean(),
  wastePresence: z.enum(['NONE', 'LOW', 'MODERATE', 'SIGNIFICANT', 'OVERWHELMING']),
  wasteCategory: z.enum([
    'WASTE_HOTSPOT',
    'ILLEGAL_DUMPING',
    'OVERFLOWING_BIN',
    'MISSED_COLLECTION',
    'MIXED_WASTE',
    'CONSTRUCTION_DEBRIS',
    'NO_CLEAR_ISSUE',
    'OTHER',
  ]),
  secondaryCategories: z.array(z.string()).default([]),
  visibleSeverity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  estimatedVolume: z.string().min(1),
  potentialObstruction: z.enum(['NONE', 'SIDEWALK', 'STORM_DRAIN', 'ROADWAY', 'MULTIPLE']),
  environmentalRiskIndicators: z.array(z.string()).default([]),
  evidenceQuality: z.enum(['HIGH', 'MEDIUM', 'LOW', 'BLURRY_UNREADABLE']),
  limitations: z.string(),
  requiresHumanReview: z.boolean(),
  description: z.string().min(1),
  recommendedAction: z.string().min(1),
  detectedObjects: z.array(z.string()).default([]),
});

export type GeminiVisionAnalysis = z.infer<typeof geminiVisionAnalysisSchema>;


