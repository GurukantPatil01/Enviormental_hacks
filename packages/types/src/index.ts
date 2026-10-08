/**
 * EcoPulse Domain & Shared Types
 */

// ==========================================
// Roles & Authorization
// ==========================================
export type UserRole = 'RESIDENT' | 'MAINTAINER' | 'WARD_ADMIN' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface ResidentProfile {
  userId: string;
  bio?: string | null;
  preferredLanguage: string;
  notificationsEnabled: boolean;
  createdAt: string;
}

export interface MaintainerProfile {
  userId: string;
  department: string;
  badgeNumber: string;
  activeZoneId?: string | null;
  createdAt: string;
}

// ==========================================
// Geographic Foundation: City > Ward > Cluster
// ==========================================
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface City {
  id: string;
  name: string;
  code: string;
  state?: string | null;
  country?: string | null;
  center?: GeoPoint | null;
}

export interface Ward {
  id: string;
  cityId: string;
  name: string;
  code: string;
  center?: GeoPoint | null;
}

type ClusterMetricKey =
  | 'environment'
  | 'participation'
  | 'service'
  | 'incidents_open'
  | 'progress';

export interface ClusterMetricPoint {
  metricKey: ClusterMetricKey | string;
  value: number;
  periodStart?: string | null;
  recordedAt: string;
}

export interface ClusterSummary {
  id: string;
  communityId: string;
  communityName?: string;
  wardId?: string | null;
  wardName?: string | null;
  code: string;
  name: string;
  description?: string | null;
  center: GeoPoint;
  /** Simplified GeoJSON polygon for rendering on the map. */
  boundaryGeoJson: Record<string, unknown>;
  memberCount: number;
  openReportsCount?: number;
  activeMissionsCount?: number;
  metrics?: {
    environment?: number;
    participation?: number;
    service?: number;
    incidentsOpen?: number;
    progress?: number;
  };
}

export interface ClusterDetail extends ClusterSummary {
  metricsHistory?: ClusterMetricPoint[];
  currentMilestone?: {
    id: string;
    title: string;
    description: string;
    targetProgress: number;
    status: string;
  } | null;
  recentActivity?: Array<{
    id: string;
    type: 'REPORT' | 'MISSION' | 'MILESTONE' | 'POINTS';
    title: string;
    createdAt: string;
  }>;
}

export interface ResolvedLocation {
  city: City | null;
  ward: Ward | null;
  cluster: ClusterSummary | null;
}

export interface MapOverview {
  clusters: ClusterSummary[];
  reports: Array<{
    id: string;
    category: string;
    status: string;
    title: string;
    lat: number;
    lng: number;
    clusterCode?: string | null;
    createdAt: string;
  }>;
  viewport: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

// ==========================================
// Community
// ==========================================
export type CommunityStatus = 'ACTIVE' | 'INACTIVE';
export type CommunityMemberRole = 'MEMBER' | 'LEAD' | 'MODERATOR';

export interface Community {
  id: string;
  name: string;
  slug: string;
  description: string;
  locationName: string;
  boundaryGeoJson?: Record<string, unknown> | null;
  status: CommunityStatus;
  currentProgress: number; // 0 - 100 percentage
  memberCount?: number;
  activeMissionsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityMember {
  id: string;
  communityId: string;
  userId: string;
  role: CommunityMemberRole;
  joinedAt: string;
  user?: Pick<User, 'id' | 'fullName' | 'email'>;
}

// ==========================================
// Missions
// ==========================================
export type MissionCategory =
  | 'CLEANLINESS'
  | 'WASTE_SEGREGATION'
  | 'TREE_PLANTING'
  | 'ENERGY_SAVING'
  | 'INSPECTION';

export type MissionVerificationType =
  | 'AUTOMATIC'
  | 'PHOTO'
  | 'PEER'
  | 'MAINTAINER';

export type MissionStatus = 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';
export type ParticipantStatus = 'NOT_STARTED' | 'STARTED' | 'COMPLETED' | 'FAILED' | 'ABANDONED';

export interface Mission {
  id: string;
  communityId: string;
  title: string;
  description: string;
  category: MissionCategory;
  pointsReward: number;
  verificationType: MissionVerificationType;
  status: MissionStatus;
  userParticipationStatus?: ParticipantStatus;
  participantCount?: number;
  expiresAt?: string | null;
  createdAt: string;
}

export interface MissionParticipant {
  id: string;
  missionId: string;
  userId: string;
  status: ParticipantStatus;
  startedAt: string;
  completedAt?: string | null;
}

export interface MissionEvent {
  id: string;
  missionId: string;
  participantId?: string | null;
  userId: string;
  eventType: 'STARTED' | 'COMPLETED' | 'VERIFIED';
  clientEventId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

// ==========================================
// Point System & Immutable Ledger
// ==========================================
export type PointSource =
  | 'MISSION_COMPLETED'
  | 'VERIFIED_REPORT'
  | 'COMMUNITY_MILESTONE'
  | 'INVALID_SUBMISSION'
  | 'MANUAL_ADJUSTMENT'
  | 'REWARD_REDEMPTION'
  | 'REWARD_REVERSAL';

export type PointType = 'CREDIT' | 'DEBIT';

export interface PointLedgerEntry {
  id: string;
  transactionId: string;
  userId: string;
  communityId?: string | null;
  source: PointSource;
  referenceId: string;
  amount: number; // positive for credits, negative or positive depending on type
  type: PointType;
  approvedBy?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface PointBalance {
  userId: string;
  totalPoints: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  lastTransactionAt?: string | null;
}

// ==========================================
// Streaks
// ==========================================
export interface Streak {
  id: string;
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string | null; // YYYY-MM-DD
  updatedAt: string;
}

// ==========================================
// Activity & Auditing
// ==========================================
export interface ActivityItem {
  id: string;
  userId: string;
  type: 'MISSION_COMPLETED' | 'POINTS_AWARDED' | 'COMMUNITY_JOINED' | 'STREAK_EXTENDED';
  title: string;
  description: string;
  points?: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: string;
}

// ==========================================
// Community Intelligence & Scoring
// ==========================================
export type CommunityTrend = 'IMPROVING' | 'STABLE' | 'DECLINING';

export interface CommunityState {
  communityId: string;
  behaviourScore: number; // 0 - 100
  participationScore: number; // 0 - 100
  serviceScore: number; // 0 - 100
  environmentalScore: number; // 0 - 100
  overallProgress: number; // 0 - 100
  trend: CommunityTrend;
  lastUpdated: string;
  weights: {
    behaviour: number;
    participation: number;
    service: number;
    environmental: number;
  };
}

export type MilestoneStatus = 'LOCKED' | 'IN_PROGRESS' | 'ACHIEVED' | 'REDEEMED';

export interface CommunityMilestone {
  id: string;
  communityId: string;
  title: string;
  description: string;
  targetProgress: number; // e.g. 25, 50, 75, 100
  rewardTitle: string;
  rewardDescription: string;
  status: MilestoneStatus;
  achievedAt?: string | null;
  createdAt: string;
}

export type TimelineCategory =
  | 'OBSERVATION'
  | 'REPORT'
  | 'VERIFICATION'
  | 'TASK'
  | 'OUTCOME'
  | 'MILESTONE';

export interface CommunityTimelineEntry {
  id: string;
  communityId: string;
  timestamp: string;
  eventType: string;
  title: string;
  description: string;
  category: TimelineCategory;
  actorId?: string | null;
  actorName?: string | null;
}

// ==========================================
// Reporting & Evidence
// ==========================================
export type ReportCategory =
  | 'WASTE_HOTSPOT'
  | 'ILLEGAL_DUMPING'
  | 'OVERFLOWING_BIN'
  | 'MISSED_COLLECTION'
  | 'MIXED_WASTE'
  | 'OTHER';

export type ReportStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'RESOLVED'
  | 'CLOSED';

export interface Report {
  id: string;
  userId: string;
  communityId: string;
  category: ReportCategory;
  title: string;
  description: string;
  status: ReportStatus;
  locationGeoJson?: Record<string, unknown> | null;
  locationAddress?: string | null;
  clientEventId?: string | null;
  pointsReward: number;
  evidence?: Evidence[];
  reviews?: HumanReview[];
  user?: Pick<User, 'id' | 'fullName' | 'email'>;
  createdAt: string;
  updatedAt: string;
}

export type VerificationMethod = 'MANUAL' | 'AUTOMATED' | 'AI';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Evidence {
  id: string;
  reportId?: string | null;
  missionId?: string | null;
  uploaderId?: string | null;
  mediaUrl: string;
  mediaType: string; // 'IMAGE', 'VIDEO', 'DOCUMENT'
  locationGeoJson?: Record<string, unknown> | null;
  verificationStatus: VerificationStatus;
  metadata?: Record<string, unknown> | null;
  uploadedAt: string;
}

// ==========================================
// Human Review & AI Advisory Abstraction
// ==========================================
export type ReviewEntityType = 'REPORT' | 'TASK' | 'MISSION';
export type ReviewDecision = 'APPROVED' | 'REJECTED' | 'PENDING' | 'REQUEST_MORE_EVIDENCE';

export type VisionWasteCategory =
  | 'WASTE_HOTSPOT'
  | 'ILLEGAL_DUMPING'
  | 'OVERFLOWING_BIN'
  | 'MIXED_WASTE'
  | 'MISSED_COLLECTION'
  | 'NO_CLEAR_ISSUE';

export type ObservationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface VisionObservation {
  evidenceId: string;
  category: VisionWasteCategory;
  detectedObjects: string[];
  severity: ObservationSeverity;
  confidence: number;
  observations: string;
  model: string;
  provider: 'MOCK' | 'BEDROCK';
  processingDurationMs: number;
  createdAt: string;
}

export type AIRecommendationAction =
  | 'NO_ACTION'
  | 'REQUEST_MORE_EVIDENCE'
  | 'VERIFY_REPORT'
  | 'DISPATCH_FIELD_TASK'
  | 'ESCALATE';

export interface AIRecommendation {
  id: string;
  entityType: ReviewEntityType;
  entityId: string;
  evidenceId?: string | null;
  recommendation: AIRecommendationAction;
  confidence: number;
  reason: string;
  detectedIssue?: string;
  severity?: ObservationSeverity;
  detectedObjects?: string[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface HumanReview {
  id: string;
  entityType: ReviewEntityType;
  entityId: string;
  recommendation?: string | null;
  confidence?: number;
  reviewerId?: string | null;
  reviewer?: Pick<User, 'id' | 'fullName' | 'role'>;
  decision: ReviewDecision;
  reason?: string | null;
  evidenceId?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  aiConfidence?: number | null;
  detectedIssue?: string | null;
  severity?: ObservationSeverity | null;
  detectedObjects?: string[] | null;
  createdAt: string;
}

export type AgentRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'in_progress'
  | 'completed'
  | 'failed';

export interface AgentRun {
  id: string;
  agentId?: string | null;
  agentType?: string;
  entityType?: string;
  entityId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  status: AgentRunStatus;
  provider?: string;
  model?: string;
  startedAt: string;
  completedAt?: string | null;
  inputReference?: string | null;
  outputReference?: Record<string, unknown> | null;
  roundCount?: number;
  totalDuration?: number;
  finalResponse?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}


// ==========================================
// Field Operations & Tasks
// ==========================================
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'CANCELLED';

export interface Task {
  id: string;
  communityId: string;
  reportId?: string | null;
  assignedTo?: string | null;
  assignedUser?: Pick<User, 'id' | 'fullName' | 'email'>;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  report?: Pick<Report, 'id' | 'title' | 'category' | 'status'>;
  createdAt: string;
  updatedAt: string;
}

export interface OperationsSummary {
  openIncidentsCount: number;
  pendingReviewsCount: number;
  activeTasksCount: number;
  resolvedTodayCount: number;
  communityPulseScore: number;
  highPriorityIncidents: number;
}

// ==========================================
// Resident Impact
// ==========================================
export interface ImpactSummary {
  userId: string;
  totalPointsEarned: number;
  verifiedActionsCount: number;
  currentStreak: number;
  longestStreak: number;
  verifiedReportsCount: number;
  completedMissionsCount: number;
  communityContributionScore: number; // percentage or relative index
  badgesEarned: string[];
}

// ==========================================
// Domain Events
// ==========================================
export type DomainEventType =
  | 'USER_REGISTERED'
  | 'COMMUNITY_JOINED'
  | 'MISSION_STARTED'
  | 'MISSION_COMPLETED'
  | 'REPORT_CREATED'
  | 'REPORT_SUBMITTED'
  | 'REPORT_VERIFIED'
  | 'REPORT_REJECTED'
  | 'EVIDENCE_ADDED'
  | 'EVIDENCE_UPLOADED'
  | 'EVIDENCE_VERIFIED'
  | 'EVIDENCE_PROCESSING_REQUESTED'
  | 'EVIDENCE_PROCESSING_STARTED'
  | 'EVIDENCE_ANALYZED'
  | 'AI_ANALYSIS_REQUESTED'
  | 'AI_ANALYSIS_COMPLETED'
  | 'AI_RECOMMENDATION_CREATED'
  | 'AI_RECOMMENDATION_FAILED'
  | 'EMBEDDING_REQUESTED'
  | 'EMBEDDING_CREATED'
  | 'HOTSPOT_ANALYSIS_REQUESTED'
  | 'HOTSPOT_UPDATED'
  | 'INTERVENTION_CREATED'
  | 'INTERVENTION_COMPLETED'
  | 'OUTCOME_MEASURED'
  | 'REVIEW_CREATED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_REJECTED'
  | 'TASK_CREATED'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'TASK_VERIFIED'
  | 'COMMUNITY_PROGRESS_UPDATED'
  | 'MILESTONE_REACHED'
  | 'POINTS_AWARDED'
  | 'POINTS_REVOKED'
  | 'STREAK_STARTED'
  | 'STREAK_EXTENDED'
  | 'STREAK_BROKEN'
  | 'REWARD_CLAIMED'
  | 'REWARD_CANCELLED';

export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  type: DomainEventType;
  aggregateId: string;
  actorId?: string | null;
  timestamp: string;
  payload: T;
}

export interface EcoPulseEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: DomainEventType;
  version: number;
  source: string;
  timestamp: string;
  correlationId: string;
  payload: T;
  actorId?: string | null;
  id?: string;
  type?: DomainEventType;
  aggregateId?: string;
}

// ==========================================
// API DTOs & Contracts
// ==========================================
export interface ApiResponse<T> {
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface HomeDashboardData {
  user: User;
  community: Community | null;
  communityState?: CommunityState;
  pointBalance: number;
  currentStreak: number;
  activeMission: Mission | null;
  recentActivity: ActivityItem[];
  nextMilestone?: CommunityMilestone | null;
}

export interface MissionCompleteResponse {
  status: 'COMPLETED' | 'ALREADY_COMPLETED';
  missionId: string;
  pointsAwarded: number;
  pointBalance: number;
  currentStreak: number;
  streakExtended: boolean;
  ledgerEntry: PointLedgerEntry;
}

// ==========================================
// Rewards & Government Ticket Discount Coupons
// ==========================================
export type RewardCategory =
  | 'TRANSIT_PASS'
  | 'METRO_DISCOUNT'
  | 'MUNICIPAL_TICKET'
  | 'PARKS_AND_RECREATION'
  | 'GOVERNMENT_UTILITY'
  | 'OTHER';

export type RewardStatus = 'ACTIVE' | 'PAUSED' | 'OUT_OF_STOCK' | 'EXPIRED';

export interface RewardPartner {
  id: string;
  name: string;
  category: string;
  contactEmail?: string | null;
  logoUrl?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface Reward {
  id: string;
  partnerId: string;
  partnerName?: string;
  partnerLogoUrl?: string | null;
  title: string;
  description: string;
  category: RewardCategory;
  costPoints: number;
  discountPercent?: number | null;
  discountAmountInr?: number | null;
  inventoryTotal: number;
  inventoryRemaining: number;
  redemptionInstructions: string;
  terms?: string | null;
  status: RewardStatus;
  validUntil?: string | null;
  createdAt: string;
}

export type ClaimStatus = 'CLAIMED' | 'USED' | 'EXPIRED' | 'CANCELLED';

export interface RewardClaim {
  id: string;
  rewardId: string;
  userId: string;
  rewardTitle?: string;
  rewardCategory?: RewardCategory;
  partnerName?: string;
  clientEventId: string;
  costPoints: number;
  couponCode: string;
  status: ClaimStatus;
  claimedAt: string;
  usedAt?: string | null;
  expiresAt: string;
  redemptionInstructions?: string;
  metadata?: Record<string, unknown> | null;
}

// ==========================================
// 11. Environmental Intelligence Domain Layer
// ==========================================

export interface EnvironmentalEvent {
  id: string;
  reportId?: string | null;
  userId?: string | null;
  eventType?: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  geometry?: Record<string, unknown> | null;
  description: string;
  status: string;
  source: string; // 'CITIZEN_REPORT', 'IOT_SENSOR', 'DRONE_SCAN', 'MANUAL_AUDIT'
  severity?: string;
  observation?: {
    wasteType: string;
    severity?: string;
    confidence?: number;
    estimatedVolume?: string | null;
    environmentalRisk?: string | null;
    publicSafetyRisk?: string | null;
    recommendedAction?: string | null;
    illegalDumpingLikelihood?: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AIObservation {
  id: string;
  eventId: string;
  modelProvider: string; // 'mock', 'bedrock', 'local'
  modelName: string;
  wasteType: string;
  secondaryWasteTypes?: string[];
  severity: ObservationSeverity; // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  confidence: number;
  estimatedVolume?: string | null;
  environmentalRisk?: string | null;
  publicSafetyRisk?: string | null;
  illegalDumpingLikelihood?: number | null;
  recommendedAction?: string | null;
  rawMetadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface EnvironmentalEmbedding {
  id: string;
  eventId: string;
  provider: string; // 'mock', 'bedrock-titan', 'local'
  model: string;
  modality: 'TEXT' | 'IMAGE' | 'MULTIMODAL';
  dimensions: number;
  vector: number[];
  createdAt: string;
}

export interface Hotspot {
  id: string;
  geometry?: Record<string, unknown> | null;
  centerLatitude: number;
  centerLongitude: number;
  radius: number; // in meters
  reportCount: number;
  averageSeverity: number;
  dominantWasteType: string;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  score: number;
  status: 'ACTIVE' | 'INVESTIGATING' | 'MITIGATED' | 'RESOLVED';
  firstDetectedAt: string;
  lastDetectedAt: string;
}

export type InterventionType =
  | 'CLEANUP_CREW'
  | 'ADD_BIN'
  | 'COMMUNITY_DRIVE'
  | 'SURVEILLANCE_CAMERA'
  | 'ENFORCEMENT_FINE'
  | 'DRAIN_DESILTING';

export type InterventionStatus =
  | 'PROPOSED'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type InterventionPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export interface Intervention {
  id: string;
  hotspotId?: string | null;
  type: string;
  priority: InterventionPriority;
  status: InterventionStatus;
  assignedTeam?: string | null;
  notes?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface InterventionOutcome {
  id: string;
  interventionId: string;
  beforeReportRate: number;
  afterReportRate: number;
  beforeSeverity: number;
  afterSeverity: number;
  beforeHotspotSize: number;
  afterHotspotSize: number;
  successScore: number;
  measuredAt: string;
}

export interface AgentToolCall {
  id: string;
  agentRunId: string;
  round: number;
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  status: 'SUCCESS' | 'ERROR' | 'TIMEOUT';
  duration: number;
  error?: string | null;
  createdAt: string;
}

export interface ChartSpec {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
  title: string;
  xAxis: string;
  yAxis: string;
  series: Array<{
    name: string;
    data: Array<{ x: string | number; y: number }>;
  }>;
}

export interface MapLayer {
  id: string;
  type: 'markers' | 'heatmap' | 'polygons' | 'hotspot_circles';
  data: any[];
  style?: Record<string, unknown>;
}

export interface MapSpec {
  center: { lat: number; lng: number };
  zoom: number;
  layers: MapLayer[];
}


