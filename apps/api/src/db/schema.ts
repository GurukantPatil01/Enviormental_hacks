import {
  boolean,
  customType,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';


// ==========================================
// 1. Users & Profiles
// ==========================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  role: varchar('role', { length: 50 }).notNull().default('RESIDENT'), // RESIDENT, MAINTAINER, WARD_ADMIN, SUPER_ADMIN
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const residentProfiles = pgTable('resident_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  preferredLanguage: varchar('preferred_language', { length: 20 }).default('en').notNull(),
  notificationsEnabled: boolean('notifications_enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const maintainerProfiles = pgTable('maintainer_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  department: varchar('department', { length: 100 }).notNull(),
  badgeNumber: varchar('badge_number', { length: 50 }).notNull(),
  activeZoneId: varchar('active_zone_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 2. Communities & Memberships
// ==========================================
export const communities = pgTable('communities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description').notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  boundaryGeoJson: jsonb('boundary_geojson'),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // ACTIVE, INACTIVE
  currentProgress: integer('current_progress').notNull().default(0), // 0 to 100%
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityMembers = pgTable(
  'community_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }).notNull().default('MEMBER'), // MEMBER, LEAD, MODERATOR
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('community_members_user_community_idx').on(table.communityId, table.userId),
  ]
);

// Retired: community_zones (superseded by cities/wards/clusters).
export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  state: varchar('state', { length: 120 }),
  country: varchar('country', { length: 120 }).default('India'),
  boundaryGeoJson: jsonb('boundary_geojson'),
  centerLat: doublePrecision('center_lat'),
  centerLng: doublePrecision('center_lng'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const wards = pgTable('wards', {
  id: uuid('id').primaryKey().defaultRandom(),
  cityId: uuid('city_id')
    .notNull()
    .references(() => cities.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 180 }).notNull(),
  code: varchar('code', { length: 80 }).notNull(),
  boundaryGeoJson: jsonb('boundary_geojson'),
  centerLat: doublePrecision('center_lat'),
  centerLng: doublePrecision('center_lng'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clusters = pgTable('clusters', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'set null' }),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 180 }).notNull(),
  description: text('description'),
  boundaryGeoJson: jsonb('boundary_geojson').notNull(),
  centerLat: doublePrecision('center_lat').notNull(),
  centerLng: doublePrecision('center_lng').notNull(),
  minLat: doublePrecision('min_lat').notNull(),
  maxLat: doublePrecision('max_lat').notNull(),
  minLng: doublePrecision('min_lng').notNull(),
  maxLng: doublePrecision('max_lng').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clusterMembers = pgTable(
  'cluster_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clusterId: uuid('cluster_id')
      .notNull()
      .references(() => clusters.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(true),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_cluster_member').on(table.clusterId, table.userId),
  ]
);

export const clusterMetrics = pgTable('cluster_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clusterId: uuid('cluster_id')
    .notNull()
    .references(() => clusters.id, { onDelete: 'cascade' }),
  metricKey: varchar('metric_key', { length: 100 }).notNull(),
  metricValue: integer('metric_value').notNull(),
  periodStart: date('period_start'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityProjects = pgTable('community_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  targetPoints: integer('target_points').notNull(),
  currentPoints: integer('current_points').notNull().default(0),
  status: varchar('status', { length: 50 }).notNull().default('IN_PROGRESS'), // IN_PROGRESS, UNLOCKED, COMPLETED
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const communityMetrics = pgTable('community_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  metricKey: varchar('metric_key', { length: 100 }).notNull(),
  metricValue: integer('metric_value').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 3. Missions & Participation
// ==========================================
export const missions = pgTable('missions', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  clusterId: uuid('cluster_id').references(() => clusters.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(), // CLEANLINESS, WASTE_SEGREGATION, TREE_PLANTING, ENERGY_SAVING, INSPECTION
  pointsReward: integer('points_reward').notNull().default(15),
  verificationType: varchar('verification_type', { length: 50 }).notNull().default('AUTOMATIC'), // AUTOMATIC, PHOTO, PEER, MAINTAINER
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'), // ACTIVE, EXPIRED, ARCHIVED
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const missionParticipants = pgTable(
  'mission_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('STARTED'), // STARTED, COMPLETED, FAILED, ABANDONED
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('mission_participants_user_mission_idx').on(table.missionId, table.userId),
  ]
);

export const missionEvents = pgTable('mission_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  missionId: uuid('mission_id')
    .notNull()
    .references(() => missions.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id').references(() => missionParticipants.id, { onDelete: 'set null' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(), // STARTED, COMPLETED, VERIFIED
  clientEventId: varchar('client_event_id', { length: 255 }).unique(), // Idempotency key
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const missionVerifications = pgTable('mission_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  missionId: uuid('mission_id')
    .notNull()
    .references(() => missions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  verifierType: varchar('verifier_type', { length: 50 }).notNull(), // SYSTEM, MAINTAINER, AI_AGENT
  status: varchar('status', { length: 50 }).notNull(), // APPROVED, REJECTED, PENDING
  notes: text('notes'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 4. Point Ledger (Authoritative Immutable Ledger)
// ==========================================
export const pointLedger = pgTable(
  'point_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id').defaultRandom().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    source: varchar('source', { length: 50 }).notNull(), // MISSION_COMPLETED, VERIFIED_REPORT, COMMUNITY_MILESTONE, INVALID_SUBMISSION, MANUAL_ADJUSTMENT
    referenceId: varchar('reference_id', { length: 255 }).notNull(),
    amount: integer('amount').notNull(),
    type: varchar('type', { length: 20 }).notNull(), // CREDIT, DEBIT
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    clientEventId: varchar('client_event_id', { length: 255 }).unique(), // Enforces strict idempotency per event
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('point_ledger_user_source_ref_idx').on(table.userId, table.source, table.referenceId),
  ]
);

// ==========================================
// 5. Streaks
// ==========================================
export const streaks = pgTable('streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActivityDate: varchar('last_activity_date', { length: 10 }), // YYYY-MM-DD
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 6. Audit Logs
// ==========================================
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 7. Community Milestones
// ==========================================
export const communityMilestones = pgTable('community_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  targetProgress: integer('target_progress').notNull(),
  rewardTitle: varchar('reward_title', { length: 255 }).notNull(),
  rewardDescription: text('reward_description').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('LOCKED'),
  achievedAt: timestamp('achieved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 8. Reporting, Evidence & Reviews
// ==========================================
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  wardId: uuid('ward_id').references(() => wards.id, { onDelete: 'set null' }),
  clusterId: uuid('cluster_id').references(() => clusters.id, { onDelete: 'set null' }),
  category: varchar('category', { length: 100 }).notNull().default('OTHER'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('SUBMITTED'), // DRAFT, SUBMITTED, UNDER_REVIEW, VERIFIED, REJECTED, RESOLVED, CLOSED
  locationGeoJson: jsonb('location_geojson'),
  locationAddress: varchar('location_address', { length: 300 }),
  clientEventId: varchar('client_event_id', { length: 255 }).unique(),
  pointsReward: integer('points_reward').notNull().default(15),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'cascade' }),
  missionId: uuid('mission_id').references(() => missions.id, { onDelete: 'cascade' }),
  uploaderId: uuid('uploader_id').references(() => users.id, { onDelete: 'set null' }),
  mediaUrl: text('media_url').notNull(),
  mediaType: varchar('media_type', { length: 50 }).notNull().default('IMAGE'),
  locationGeoJson: jsonb('location_geojson'),
  verificationStatus: varchar('verification_status', { length: 50 }).notNull().default('PENDING'),
  metadata: jsonb('metadata'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // REPORT, TASK, MISSION
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  evidenceId: uuid('evidence_id').references(() => evidence.id, { onDelete: 'set null' }),
  recommendation: text('recommendation'),
  confidence: integer('confidence').default(100),
  reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  decision: varchar('decision', { length: 50 }).notNull().default('PENDING'), // APPROVED, REJECTED, PENDING, REQUEST_MORE_EVIDENCE
  reason: text('reason'),
  aiProvider: varchar('ai_provider', { length: 50 }),
  aiModel: varchar('ai_model', { length: 100 }),
  aiConfidence: integer('ai_confidence'),
  detectedIssue: varchar('detected_issue', { length: 100 }),
  severity: varchar('severity', { length: 50 }),
  detectedObjects: jsonb('detected_objects'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const environmentalEvents = pgTable('environmental_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id').references(() => communities.id),
  reportId: text('report_id'),
  userId: text('user_id'),
  eventType: varchar('event_type', { length: 100 }).notNull().default('WASTE_HOTSPOT'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  latitude: doublePrecision('latitude').notNull().default(18.5204),
  longitude: doublePrecision('longitude').notNull().default(73.8567),
  geometry: jsonb('geometry'),
  description: text('description').notNull().default(''),
  status: varchar('status', { length: 50 }).notNull().default('REPORTED'),
  source: varchar('source', { length: 50 }).notNull().default('CITIZEN_REPORT'),
  severity: varchar('severity', { length: 50 }).notNull().default('LOW'),
  details: jsonb('details'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiObservations = pgTable('ai_observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  modelProvider: varchar('model_provider', { length: 50 }).notNull().default('mock'),
  modelName: varchar('model_name', { length: 100 }).notNull().default('mock-vision-v1'),
  wasteType: varchar('waste_type', { length: 100 }).notNull(),
  secondaryWasteTypes: jsonb('secondary_waste_types'),
  severity: varchar('severity', { length: 50 }).notNull().default('LOW'),
  confidence: doublePrecision('confidence').notNull().default(0.95),
  estimatedVolume: varchar('estimated_volume', { length: 100 }),
  environmentalRisk: text('environmental_risk'),
  publicSafetyRisk: text('public_safety_risk'),
  illegalDumpingLikelihood: doublePrecision('illegal_dumping_likelihood').default(0.1),
  recommendedAction: text('recommended_action'),
  rawMetadata: jsonb('raw_metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const environmentalEmbeddings = pgTable('environmental_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull(),
  provider: varchar('provider', { length: 50 }).notNull().default('mock'),
  model: varchar('model', { length: 100 }).notNull().default('mock-embed-v1'),
  modality: varchar('modality', { length: 50 }).notNull().default('TEXT'),
  dimensions: integer('dimensions').notNull().default(384),
  vector: jsonb('vector').notNull(), // Stores float array for vector search
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const hotspots = pgTable('hotspots', {
  id: uuid('id').primaryKey().defaultRandom(),
  geometry: jsonb('geometry'),
  centerLatitude: doublePrecision('center_latitude').notNull(),
  centerLongitude: doublePrecision('center_longitude').notNull(),
  radius: doublePrecision('radius').notNull().default(500), // meters
  reportCount: integer('report_count').notNull().default(1),
  averageSeverity: doublePrecision('average_severity').notNull().default(1.0),
  dominantWasteType: varchar('dominant_waste_type', { length: 100 }).notNull().default('WASTE_HOTSPOT'),
  trend: varchar('trend', { length: 50 }).notNull().default('STABLE'),
  score: doublePrecision('score').notNull().default(10.0),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  firstDetectedAt: timestamp('first_detected_at', { withTimezone: true }).defaultNow().notNull(),
  lastDetectedAt: timestamp('last_detected_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const interventions = pgTable('interventions', {
  id: uuid('id').primaryKey().defaultRandom(),
  hotspotId: uuid('hotspot_id').references(() => hotspots.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 100 }).notNull().default('CLEANUP_CREW'),
  priority: varchar('priority', { length: 50 }).notNull().default('MEDIUM'),
  status: varchar('status', { length: 50 }).notNull().default('PROPOSED'),
  assignedTeam: varchar('assigned_team', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const interventionOutcomes = pgTable('intervention_outcomes', {
  id: uuid('id').primaryKey().defaultRandom(),
  interventionId: uuid('intervention_id').notNull().references(() => interventions.id, { onDelete: 'cascade' }),
  beforeReportRate: doublePrecision('before_report_rate').notNull().default(0),
  afterReportRate: doublePrecision('after_report_rate').notNull().default(0),
  beforeSeverity: doublePrecision('before_severity').notNull().default(0),
  afterSeverity: doublePrecision('after_severity').notNull().default(0),
  beforeHotspotSize: doublePrecision('before_hotspot_size').notNull().default(0),
  afterHotspotSize: doublePrecision('after_hotspot_size').notNull().default(0),
  successScore: doublePrecision('success_score').notNull().default(0),
  measuredAt: timestamp('measured_at', { withTimezone: true }).defaultNow().notNull(),
});

export const serviceEvents = pgTable('service_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id').notNull().references(() => communities.id),
  serviceType: varchar('service_type', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  communityId: uuid('community_id')
    .notNull()
    .references(() => communities.id, { onDelete: 'cascade' }),
  reportId: uuid('report_id').references(() => reports.id, { onDelete: 'set null' }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  priority: varchar('priority', { length: 50 }).notNull().default('MEDIUM'),
  status: varchar('status', { length: 50 }).notNull().default('CREATED'), // CREATED, ASSIGNED, IN_PROGRESS, COMPLETED, VERIFIED, CANCELLED
  dueDate: timestamp('due_date', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: uuid('verified_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(), // Drone Agent, Vision Agent, Scoring Agent, etc.
  type: varchar('type', { length: 50 }).notNull(),
  version: varchar('version', { length: 20 }).notNull().default('1.0.0'),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  agentType: varchar('agent_type', { length: 50 }).notNull().default('VISION'),
  entityType: varchar('entity_type', { length: 50 }).notNull().default('EVIDENCE'),
  entityId: varchar('entity_id', { length: 255 }).default('conversation'),
  conversationId: varchar('conversation_id', { length: 255 }),
  userId: text('user_id'),
  status: varchar('status', { length: 50 }).notNull().default('QUEUED'), // QUEUED, RUNNING, COMPLETED, FAILED
  provider: varchar('provider', { length: 50 }).notNull().default('MOCK'),
  model: varchar('model', { length: 100 }).notNull().default('mock-vision-v1'),
  roundCount: integer('round_count').default(1).notNull(),
  totalDuration: integer('total_duration').default(0).notNull(),
  finalResponse: text('final_response'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  inputReference: varchar('input_reference', { length: 255 }),
  outputReference: jsonb('output_reference'),
  error: text('error'),
  metadata: jsonb('metadata'),
});

export const agentToolCalls = pgTable('agent_tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentRunId: uuid('agent_run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
  round: integer('round').notNull().default(1),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  status: varchar('status', { length: 50 }).notNull().default('SUCCESS'),
  duration: integer('duration').notNull().default(0),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});


export const agentActions = pgTable('agent_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => agentRuns.id),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  payload: jsonb('payload'),
  requiresHumanApproval: boolean('requires_human_approval').default(true).notNull(),
  approvalStatus: varchar('approval_status', { length: 50 }).default('PENDING').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ==========================================
// 10. Rewards & Government Ticket Coupons
// ==========================================
export const rewardPartners = pgTable('reward_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }),
  logoUrl: text('logo_url'),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rewards = pgTable('rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  partnerId: uuid('partner_id')
    .notNull()
    .references(() => rewardPartners.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  costPoints: integer('cost_points').notNull(),
  discountPercent: integer('discount_percent'),
  discountAmountInr: integer('discount_amount_inr'),
  inventoryTotal: integer('inventory_total').notNull(),
  inventoryRemaining: integer('inventory_remaining').notNull(),
  redemptionInstructions: text('redemption_instructions').notNull(),
  terms: text('terms'),
  status: varchar('status', { length: 50 }).notNull().default('ACTIVE'),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rewardClaims = pgTable(
  'reward_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rewardId: uuid('reward_id')
      .notNull()
      .references(() => rewards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientEventId: varchar('client_event_id', { length: 255 }).notNull().unique(),
    costPoints: integer('cost_points').notNull(),
    couponCode: varchar('100').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('CLAIMED'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow().notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    uniqueIndex('uq_reward_claim_client_event').on(table.clientEventId),
  ]
);

