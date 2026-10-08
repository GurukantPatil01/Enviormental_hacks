import { pool } from './index.js';

/**
 * Ordered, idempotent migration blocks tracked in schema_migrations.
 * Each block runs exactly once per database, inside a transaction.
 *
 * RULES:
 *  - Blocks are append-only: never edit an applied block, always add a new one.
 *  - New blocks must be safe on both fresh and existing databases.
 */
interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: '0000_baseline',
    sql: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        role VARCHAR(50) NOT NULL DEFAULT 'RESIDENT',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS resident_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        bio TEXT,
        preferred_language VARCHAR(20) DEFAULT 'en' NOT NULL,
        notifications_enabled BOOLEAN DEFAULT TRUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS maintainer_profiles (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        department VARCHAR(100) NOT NULL,
        badge_number VARCHAR(50) NOT NULL,
        active_zone_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS communities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        location_name VARCHAR(255) NOT NULL,
        boundary_geojson JSONB,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        current_progress INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'MEMBER',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT uq_community_user UNIQUE (community_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS community_zones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL,
        boundary_geojson JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_projects (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        target_points INTEGER NOT NULL,
        current_points INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        metric_key VARCHAR(100) NOT NULL,
        metric_value INTEGER NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS missions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        points_reward INTEGER NOT NULL DEFAULT 15,
        verification_type VARCHAR(50) NOT NULL DEFAULT 'AUTOMATIC',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mission_participants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'STARTED',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_mission_user UNIQUE (mission_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS mission_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        participant_id UUID REFERENCES mission_participants(id) ON DELETE SET NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        client_event_id VARCHAR(255) UNIQUE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mission_verifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        verifier_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        notes TEXT,
        verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS point_ledger (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_id UUID DEFAULT uuid_generate_v4() NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
        source VARCHAR(50) NOT NULL,
        reference_id VARCHAR(255) NOT NULL,
        amount INTEGER NOT NULL,
        type VARCHAR(20) NOT NULL,
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        client_event_id VARCHAR(255) UNIQUE,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT uq_point_ledger_user_src_ref UNIQUE (user_id, source, reference_id)
      );

      CREATE TABLE IF NOT EXISTS streaks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_activity_date VARCHAR(10),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        before JSONB,
        after JSONB,
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_milestones (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        target_progress INTEGER NOT NULL,
        reward_title VARCHAR(255) NOT NULL,
        reward_description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'LOCKED',
        achieved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL DEFAULT 'OTHER',
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
        location_geojson JSONB,
        location_address VARCHAR(300),
        client_event_id VARCHAR(255) UNIQUE,
        points_reward INTEGER NOT NULL DEFAULT 15,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      ALTER TABLE reports ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'OTHER' NOT NULL;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS location_address VARCHAR(300);
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_event_id VARCHAR(255);
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS points_reward INTEGER DEFAULT 15 NOT NULL;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

      CREATE TABLE IF NOT EXISTS evidence (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
        mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
        uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
        media_url TEXT NOT NULL,
        media_type VARCHAR(50) NOT NULL DEFAULT 'IMAGE',
        location_geojson JSONB,
        verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        metadata JSONB,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      ALTER TABLE evidence ADD COLUMN IF NOT EXISTS uploader_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE evidence ADD COLUMN IF NOT EXISTS location_geojson JSONB;
      ALTER TABLE evidence ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL;
      ALTER TABLE evidence ADD COLUMN IF NOT EXISTS metadata JSONB;

      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        recommendation TEXT,
        confidence INTEGER DEFAULT 100,
        reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        decision VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS evidence_id UUID REFERENCES evidence(id) ON DELETE SET NULL;
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50);
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100);
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_confidence INTEGER;
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS detected_issue VARCHAR(100);
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS severity VARCHAR(50);
      ALTER TABLE reviews ADD COLUMN IF NOT EXISTS detected_objects JSONB;
      ALTER TABLE reviews ALTER COLUMN decision SET DEFAULT 'PENDING';

      CREATE TABLE IF NOT EXISTS environmental_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id),
        event_type VARCHAR(100) NOT NULL,
        severity VARCHAR(50) NOT NULL DEFAULT 'LOW',
        details JSONB,
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS service_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id),
        service_type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
        status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
        due_date TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        verified_at TIMESTAMP WITH TIME ZONE,
        verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'MEDIUM' NOT NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;

      CREATE TABLE IF NOT EXISTS agents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_runs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
        agent_type VARCHAR(50) NOT NULL DEFAULT 'VISION',
        entity_type VARCHAR(50) NOT NULL DEFAULT 'EVIDENCE',
        entity_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
        provider VARCHAR(50) NOT NULL DEFAULT 'MOCK',
        model VARCHAR(100) NOT NULL DEFAULT 'mock-vision-v1',
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        input_reference VARCHAR(255),
        output_reference JSONB,
        error TEXT,
        metadata JSONB
      );

      ALTER TABLE agent_runs ALTER COLUMN agent_id DROP NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50) DEFAULT 'VISION' NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'EVIDENCE' NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS entity_id VARCHAR(255) DEFAULT '' NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS provider VARCHAR(50) DEFAULT 'MOCK' NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'mock-vision-v1' NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS input_reference VARCHAR(255);
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS output_reference JSONB;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS error TEXT;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS metadata JSONB;

      CREATE TABLE IF NOT EXISTS agent_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        run_id UUID NOT NULL REFERENCES agent_runs(id),
        action_type VARCHAR(100) NOT NULL,
        payload JSONB,
        requires_human_approval BOOLEAN DEFAULT TRUE NOT NULL,
        approval_status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
        reviewed_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `,
  },
  {
    name: '0001_geo_foundation',
    sql: `
      -- Retire the unused community_zones skeleton: superseded by the
      -- City -> Ward -> Cluster hierarchy. (Table was never referenced.)
      DROP TABLE IF EXISTS community_zones CASCADE;

      CREATE TABLE IF NOT EXISTS cities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(80) NOT NULL UNIQUE,
        state VARCHAR(120),
        country VARCHAR(120) DEFAULT 'India',
        boundary_geojson JSONB,
        center_lat DOUBLE PRECISION,
        center_lng DOUBLE PRECISION,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS wards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        name VARCHAR(180) NOT NULL,
        code VARCHAR(80) NOT NULL,
        boundary_geojson JSONB,
        center_lat DOUBLE PRECISION,
        center_lng DOUBLE PRECISION,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT uq_wards_city_code UNIQUE (city_id, code)
      );

      CREATE INDEX IF NOT EXISTS idx_wards_city ON wards(city_id);

      CREATE TABLE IF NOT EXISTS clusters (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        ward_id UUID REFERENCES wards(id) ON DELETE SET NULL,
        code VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(180) NOT NULL,
        description TEXT,
        boundary_geojson JSONB NOT NULL,
        center_lat DOUBLE PRECISION NOT NULL,
        center_lng DOUBLE PRECISION NOT NULL,
        min_lat DOUBLE PRECISION NOT NULL,
        max_lat DOUBLE PRECISION NOT NULL,
        min_lng DOUBLE PRECISION NOT NULL,
        max_lng DOUBLE PRECISION NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_clusters_community ON clusters(community_id);
      CREATE INDEX IF NOT EXISTS idx_clusters_ward ON clusters(ward_id);
      CREATE INDEX IF NOT EXISTS idx_clusters_bbox ON clusters (min_lat, max_lat, min_lng, max_lng);

      CREATE TABLE IF NOT EXISTS cluster_members (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        is_primary BOOLEAN NOT NULL DEFAULT TRUE,
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT uq_cluster_member UNIQUE (cluster_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_cluster_members_user ON cluster_members(user_id);

      CREATE TABLE IF NOT EXISTS cluster_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        cluster_id UUID NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
        metric_key VARCHAR(100) NOT NULL, -- environment | participation | service | incidents_open | progress
        metric_value INTEGER NOT NULL,
        period_start DATE,
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cluster_metrics_lookup
        ON cluster_metrics (cluster_id, metric_key, recorded_at DESC);

      -- Geographic anchors for reports and missions
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS ward_id UUID REFERENCES wards(id) ON DELETE SET NULL;
      ALTER TABLE reports ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL;
      ALTER TABLE missions ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES clusters(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_reports_cluster ON reports(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_missions_cluster ON missions(cluster_id);
    `,
  },
  {
    name: '0002_rewards_and_government_coupons',
    sql: `
      -- Reward Partners (Transit authorities, municipal corporations, public utilities)
      CREATE TABLE IF NOT EXISTS reward_partners (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        contact_email VARCHAR(255),
        logo_url TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      -- Rewards & Government Discount Coupons
      CREATE TABLE IF NOT EXISTS rewards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        partner_id UUID NOT NULL REFERENCES reward_partners(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        cost_points INTEGER NOT NULL,
        discount_percent INTEGER,
        discount_amount_inr INTEGER,
        inventory_total INTEGER NOT NULL,
        inventory_remaining INTEGER NOT NULL,
        redemption_instructions TEXT NOT NULL,
        terms TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
        valid_until TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      -- Reward Claims & Issued Coupons
      CREATE TABLE IF NOT EXISTS reward_claims (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_event_id VARCHAR(255) NOT NULL UNIQUE,
        cost_points INTEGER NOT NULL,
        coupon_code VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'CLAIMED',
        claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_rewards_partner ON rewards(partner_id);
      CREATE INDEX IF NOT EXISTS idx_rewards_status_category ON rewards(status, category);
      CREATE INDEX IF NOT EXISTS idx_reward_claims_user ON reward_claims(user_id);
      CREATE INDEX IF NOT EXISTS idx_reward_claims_code ON reward_claims(coupon_code);
    `,
  },
  {
    name: '0005_environmental_intelligence',
    sql: `
      DO $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS postgis;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'PostGIS extension not available or permission denied, using GeoJSON fallback';
      END $$;

      DO $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS vector;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension not available or permission denied, using JSON vector fallback';
      END $$;

      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS conversation_id VARCHAR(255);
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS round_count INTEGER DEFAULT 1 NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS total_duration INTEGER DEFAULT 0 NOT NULL;
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS final_response TEXT;

      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS report_id UUID REFERENCES reports(id) ON DELETE CASCADE;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 18.5204 NOT NULL;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 73.8567 NOT NULL;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS geometry JSONB;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '' NOT NULL;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'REPORTED' NOT NULL;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'CITIZEN_REPORT' NOT NULL;
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS ai_observations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id UUID NOT NULL,
        model_provider VARCHAR(50) DEFAULT 'mock' NOT NULL,
        model_name VARCHAR(100) DEFAULT 'mock-vision-v1' NOT NULL,
        waste_type VARCHAR(100) NOT NULL,
        secondary_waste_types JSONB,
        severity VARCHAR(50) DEFAULT 'LOW' NOT NULL,
        confidence DOUBLE PRECISION DEFAULT 0.95 NOT NULL,
        estimated_volume VARCHAR(100),
        environmental_risk TEXT,
        public_safety_risk TEXT,
        illegal_dumping_likelihood DOUBLE PRECISION DEFAULT 0.1,
        recommended_action TEXT,
        raw_metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS environmental_embeddings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_id UUID NOT NULL,
        provider VARCHAR(50) DEFAULT 'mock' NOT NULL,
        model VARCHAR(100) DEFAULT 'mock-embed-v1' NOT NULL,
        modality VARCHAR(50) DEFAULT 'TEXT' NOT NULL,
        dimensions INTEGER DEFAULT 384 NOT NULL,
        vector JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hotspots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        geometry JSONB,
        center_latitude DOUBLE PRECISION NOT NULL,
        center_longitude DOUBLE PRECISION NOT NULL,
        radius DOUBLE PRECISION DEFAULT 500 NOT NULL,
        report_count INTEGER DEFAULT 1 NOT NULL,
        average_severity DOUBLE PRECISION DEFAULT 1.0 NOT NULL,
        dominant_waste_type VARCHAR(100) DEFAULT 'WASTE_HOTSPOT' NOT NULL,
        trend VARCHAR(50) DEFAULT 'STABLE' NOT NULL,
        score DOUBLE PRECISION DEFAULT 10.0 NOT NULL,
        status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
        first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        last_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS interventions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        hotspot_id UUID NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
        type VARCHAR(100) DEFAULT 'CLEANUP_CREW' NOT NULL,
        priority VARCHAR(50) DEFAULT 'MEDIUM' NOT NULL,
        status VARCHAR(50) DEFAULT 'PROPOSED' NOT NULL,
        assigned_team VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS intervention_outcomes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        intervention_id UUID NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
        before_report_rate DOUBLE PRECISION DEFAULT 0 NOT NULL,
        after_report_rate DOUBLE PRECISION DEFAULT 0 NOT NULL,
        before_severity DOUBLE PRECISION DEFAULT 0 NOT NULL,
        after_severity DOUBLE PRECISION DEFAULT 0 NOT NULL,
        before_hotspot_size DOUBLE PRECISION DEFAULT 0 NOT NULL,
        after_hotspot_size DOUBLE PRECISION DEFAULT 0 NOT NULL,
        success_score DOUBLE PRECISION DEFAULT 0 NOT NULL,
        measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_tool_calls (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        round INTEGER DEFAULT 1 NOT NULL,
        tool_name VARCHAR(100) NOT NULL,
        input JSONB NOT NULL,
        output JSONB,
        status VARCHAR(50) DEFAULT 'SUCCESS' NOT NULL,
        duration INTEGER DEFAULT 0 NOT NULL,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_obs_event ON ai_observations(event_id);
      CREATE INDEX IF NOT EXISTS idx_env_embed_event ON environmental_embeddings(event_id);
      CREATE INDEX IF NOT EXISTS idx_hotspots_status ON hotspots(status);
      CREATE INDEX IF NOT EXISTS idx_interventions_hotspot ON interventions(hotspot_id);
      CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON agent_tool_calls(agent_run_id);
    `,
  },
  {
    name: '0006_environmental_schema_fixes',
    sql: `
      ALTER TABLE environmental_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
      ALTER TABLE environmental_events ALTER COLUMN community_id DROP NOT NULL;
      ALTER TABLE environmental_events DROP CONSTRAINT IF EXISTS environmental_events_user_id_fkey;
      ALTER TABLE environmental_events ALTER COLUMN user_id TYPE TEXT;
      ALTER TABLE interventions ALTER COLUMN hotspot_id DROP NOT NULL;
      ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_user_id_fkey;
      ALTER TABLE agent_runs ALTER COLUMN user_id TYPE TEXT;
    `,
  },
  {
    name: '0007_relax_event_type_not_null',
    sql: `
      ALTER TABLE environmental_events ALTER COLUMN event_type DROP NOT NULL;
      ALTER TABLE environmental_events ALTER COLUMN event_type SET DEFAULT 'WASTE_REPORT';
    `,
  },
  {
    name: '0008_decouple_report_id_fkey',
    sql: `
      ALTER TABLE environmental_events DROP CONSTRAINT IF EXISTS environmental_events_report_id_fkey;
      ALTER TABLE environmental_events ALTER COLUMN report_id TYPE TEXT;
    `,
  },
];

export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.name)) {
        continue;
      }
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
          [migration.name]
        );
        await client.query('COMMIT');
        console.log(`  ✅ Applied migration: ${migration.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Migration failed: ${migration.name}`, err);
        throw err;
      }
    }
    console.log('✅ Database migrations executed successfully.');
  } finally {
    client.release();
  }
}

if (process.argv[1]?.endsWith('migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
