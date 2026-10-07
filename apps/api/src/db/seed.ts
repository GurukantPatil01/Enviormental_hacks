import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import {
  communities,
  communityMembers,
  maintainerProfiles,
  missions,
  pointLedger,
  residentProfiles,
  streaks,
  users,
} from './schema.js';

export async function seed() {
  console.log('🌱 Seeding EcoPulse development database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Demo Community
  const [demoCommunity] = await db
    .insert(communities)
    .values({
      name: 'Pune Green Community',
      slug: 'pune-green-community',
      description:
        'A citizen-driven environmental collective in Pune dedicated to waste segregation, clean corridors, urban afforestation, and sustainable living.',
      locationName: 'Kothrud & Deccan Gymkhana, Pune, Maharashtra',
      boundaryGeoJson: {
        type: 'Polygon',
        coordinates: [
          [
            [73.818, 18.507],
            [73.845, 18.507],
            [73.845, 18.525],
            [73.818, 18.525],
            [73.818, 18.507],
          ],
        ],
      },
      status: 'ACTIVE',
      currentProgress: 68,
    })
    .onConflictDoNothing()
    .returning();

  // If already exists, query it
  let community = demoCommunity;
  if (!community) {
    const [found] = await db.select().from(communities).where(eq(communities.slug, 'pune-green-community'));
    community = found;
  }

  if (!community) {
    throw new Error('Failed to create or retrieve demo community');
  }

  console.log(`📍 Community seeded: ${community.name} (${community.id})`);

  // 2. Create Maintainer
  const maintainerEmail = 'maintainer@ecopulse.org';
  let [maintainerUser] = await db
    .insert(users)
    .values({
      email: maintainerEmail,
      passwordHash,
      fullName: 'Suresh Kulkarni',
      phone: '+91 98220 12345',
      role: 'MAINTAINER',
    })
    .onConflictDoNothing()
    .returning();

  if (!maintainerUser) {
    const [found] = await db.select().from(users).where(eq(users.email, maintainerEmail));
    maintainerUser = found;
  }

  await db
    .insert(maintainerProfiles)
    .values({
      userId: maintainerUser.id,
      department: 'PMC Environmental Sanitation Division',
      badgeNumber: 'PMC-ENV-402',
      activeZoneId: 'Zone-4-Kothrud',
    })
    .onConflictDoNothing();

  await db
    .insert(communityMembers)
    .values({
      communityId: community.id,
      userId: maintainerUser.id,
      role: 'LEAD',
    })
    .onConflictDoNothing();

  console.log(`👷 Maintainer seeded: ${maintainerUser.fullName}`);

  // 3. Create 6 Demo Residents
  const demoResidents = [
    {
      email: 'priya.sharma@example.com',
      fullName: 'Priya Sharma',
      bio: 'Terrace composting enthusiast & weekend trail cleaner in Kothrud.',
      initialPoints: 340,
      streak: 12,
      lastActive: new Date().toISOString().split('T')[0],
    },
    {
      email: 'aarav.patel@example.com',
      fullName: 'Aarav Patel',
      bio: 'Cycling commuter tracking local air quality.',
      initialPoints: 215,
      streak: 7,
      lastActive: new Date().toISOString().split('T')[0],
    },
    {
      email: 'ananya.iyer@example.com',
      fullName: 'Ananya Iyer',
      bio: 'Zero-waste advocate and community compost coordinator.',
      initialPoints: 520,
      streak: 19,
      lastActive: new Date().toISOString().split('T')[0],
    },
    {
      email: 'vikram.deshmukh@example.com',
      fullName: 'Vikram Deshmukh',
      bio: 'Green corridor walker and native tree planter.',
      initialPoints: 180,
      streak: 4,
      lastActive: new Date().toISOString().split('T')[0],
    },
    {
      email: 'rohan.joshi@example.com',
      fullName: 'Rohan Joshi',
      bio: 'Solar energy advocate and tech volunteer.',
      initialPoints: 95,
      streak: 2,
      lastActive: new Date().toISOString().split('T')[0],
    },
    {
      email: 'neha.kulkarni@example.com',
      fullName: 'Neha Kulkarni',
      bio: 'Student environmental leader leading clean-up drives.',
      initialPoints: 410,
      streak: 14,
      lastActive: new Date().toISOString().split('T')[0],
    },
  ];

  for (const res of demoResidents) {
    let [resUser] = await db
      .insert(users)
      .values({
        email: res.email,
        passwordHash,
        fullName: res.fullName,
        role: 'RESIDENT',
      })
      .onConflictDoNothing()
      .returning();

    if (!resUser) {
      const [found] = await db.select().from(users).where(eq(users.email, res.email));
      resUser = found!;
    }

    await db
      .insert(residentProfiles)
      .values({
        userId: resUser.id,
        bio: res.bio,
        preferredLanguage: 'en',
        notificationsEnabled: true,
      })
      .onConflictDoNothing();

    await db
      .insert(communityMembers)
      .values({
        communityId: community.id,
        userId: resUser.id,
        role: 'MEMBER',
      })
      .onConflictDoNothing();

    // Streak
    await db
      .insert(streaks)
      .values({
        userId: resUser.id,
        currentStreak: res.streak,
        longestStreak: Math.max(res.streak, 15),
        lastActivityDate: res.lastActive,
      })
      .onConflictDoNothing();

    // Point Ledger entry (starting baseline)
    await db
      .insert(pointLedger)
      .values({
        userId: resUser.id,
        communityId: community.id,
        source: 'COMMUNITY_MILESTONE',
        referenceId: `welcome-grant-${resUser.id}`,
        amount: res.initialPoints,
        type: 'CREDIT',
        clientEventId: `init-grant-${resUser.id}`,
        metadata: {
          note: 'Development seed initial point grant',
          isSeed: true,
        },
      })
      .onConflictDoNothing();
  }

  console.log(`👥 Demo residents seeded: ${demoResidents.length}`);

  // 4. Create 3 Real Missions
  const missionsList = [
    {
      title: 'Walk the Clean Route',
      description:
        'Walk through the designated Kothrud Green Corridor and inspect for litter or plastic waste along the walkway.',
      category: 'CLEANLINESS',
      pointsReward: 15,
      verificationType: 'AUTOMATIC',
      status: 'ACTIVE',
    },
    {
      title: 'Report a Waste Hotspot',
      description:
        'Take a verified geo-tagged photograph of an unmanaged waste dump or overflowing bin in your ward for sanitation crew action.',
      category: 'INSPECTION',
      pointsReward: 25,
      verificationType: 'PHOTO',
      status: 'ACTIVE',
    },
    {
      title: 'Segregate Your Household Waste',
      description:
        'Demonstrate 3-way segregation (Wet / Dry / Sanitary) at your home collection point for the morning pickup.',
      category: 'WASTE_SEGREGATION',
      pointsReward: 20,
      verificationType: 'AUTOMATIC',
      status: 'ACTIVE',
    },
  ];

  for (const m of missionsList) {
    await db
      .insert(missions)
      .values({
        communityId: community.id,
        title: m.title,
        description: m.description,
        category: m.category,
        pointsReward: m.pointsReward,
        verificationType: m.verificationType,
        status: m.status,
      })
      .onConflictDoNothing();
  }

  console.log(`🎯 Missions seeded: ${missionsList.length}`);

  // 5. Seed Community Milestones
  const demoMilestones = [
    {
      title: 'Community Composting Facility',
      description: 'Setup community aerobic composting bins at Kothrud ward center.',
      targetProgress: 25,
      rewardTitle: 'Wet Waste Processing Hub',
      rewardDescription: 'Free organic compost distribution for all ward residents.',
      status: 'ACHIEVED',
      achievedAt: new Date(Date.now() - 14 * 86400000),
    },
    {
      title: 'Solar Street Lights Corridor',
      description: 'Install 20 solar-powered LED lights along the green corridor walking path.',
      targetProgress: 50,
      rewardTitle: 'Solar Corridor Illumination',
      rewardDescription: 'Safe, low-emission pedestrian lighting throughout Kothrud.',
      status: 'ACHIEVED',
      achievedAt: new Date(Date.now() - 5 * 86400000),
    },
    {
      title: 'Community Environmental Lab',
      description: 'Air and water quality testing station with public sensor dashboard.',
      targetProgress: 75,
      rewardTitle: 'Community EcoLab',
      rewardDescription: 'Citizen science laboratory and student environmental workshops.',
      status: 'IN_PROGRESS',
    },
    {
      title: 'Urban Afforestation Bio-Reserve',
      description: 'Miyawaki dense native forest planted across 1 acre of municipal land.',
      targetProgress: 100,
      rewardTitle: 'Kothrud Miyawaki Forest',
      rewardDescription: 'Permanent green lung producing 5000+ native trees and biodiversity sanctuary.',
      status: 'LOCKED',
    },
  ];

  const { communityMilestones, reports, evidence, reviews, tasks, agentRuns } = await import('./schema.js');

  for (const m of demoMilestones) {
    await db
      .insert(communityMilestones)
      .values({
        communityId: community.id,
        title: m.title,
        description: m.description,
        targetProgress: m.targetProgress,
        rewardTitle: m.rewardTitle,
        rewardDescription: m.rewardDescription,
        status: m.status,
        achievedAt: (m as any).achievedAt ?? null,
      })
      .onConflictDoNothing();
  }
  console.log(`🏆 Milestones seeded: ${demoMilestones.length}`);

  // 6. Seed Reports with Evidence
  const [aarav] = await db.select().from(users).where(eq(users.email, 'aarav.patel@example.com'));
  const [priya] = await db.select().from(users).where(eq(users.email, 'priya.sharma@example.com'));

  if (aarav && priya) {
    const [report1] = await db
      .insert(reports)
      .values({
        userId: aarav.id,
        communityId: community.id,
        category: 'ILLEGAL_DUMPING',
        title: 'Illegal construction debris dumped by riverbank',
        description: 'Large pile of concrete and plastic bags dumped adjacent to the Mutha river walkway near Deccan.',
        status: 'VERIFIED',
        locationAddress: 'Mutha River Walkway, Deccan Gymkhana',
        pointsReward: 20,
      })
      .returning();

    if (report1) {
      await db.insert(evidence).values({
        reportId: report1.id,
        uploaderId: aarav.id,
        mediaUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80',
        mediaType: 'IMAGE',
        verificationStatus: 'VERIFIED',
      });

      // Human review
      await db.insert(reviews).values({
        entityType: 'REPORT',
        entityId: report1.id,
        recommendation: 'Clear debris immediately; location obstructs storm runoff.',
        confidence: 96,
        reviewerId: maintainerUser.id,
        decision: 'APPROVED',
        reason: 'Confirmed visual match with geo-tagged location.',
      });

      // Task
      await db.insert(tasks).values({
        communityId: community.id,
        reportId: report1.id,
        assignedTo: maintainerUser.id,
        title: 'Deploy Debris Removal Truck to Deccan Riverbank',
        description: 'Clear approximately 2 tonnes of construction waste from river walkway.',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      });
    }

    const [report2] = await db
      .insert(reports)
      .values({
        userId: priya.id,
        communityId: community.id,
        category: 'OVERFLOWING_BIN',
        title: 'Overflowing dry waste bin near Kothrud Bus Stand',
        description: 'Dry waste bin has been overflowing for 2 days. Plastic bottles spilling onto sidewalk.',
        status: 'SUBMITTED',
        locationAddress: 'Kothrud Stand, DP Road, Pune',
        pointsReward: 15,
      })
      .returning();

    if (report2) {
      const [ev2] = await db
        .insert(evidence)
        .values({
          reportId: report2.id,
          uploaderId: priya.id,
          mediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=800&q=80',
          mediaType: 'IMAGE',
          verificationStatus: 'PENDING',
        })
        .returning();

      if (ev2) {
        // AI Review (Advisory only, decision: PENDING)
        await db.insert(reviews).values({
          entityType: 'REPORT',
          entityId: report2.id,
          evidenceId: ev2.id,
          recommendation: 'DISPATCH_FIELD_TASK',
          reason: 'Evidence indicates high-density overflowing waste obstructing pedestrian path. Recommend municipal field crew clearance.',
          confidence: 91,
          aiProvider: 'mock',
          aiModel: 'ecopulse-vision-v1',
          aiConfidence: 91,
          detectedIssue: 'OVERFLOWING_BIN',
          severity: 'HIGH',
          detectedObjects: [
            'overflowing municipal bin',
            'loose plastic packaging',
            'beverage containers',
            'sidewalk obstruction',
          ],
          decision: 'PENDING',
        });

        // Audit agent runs
        await db.insert(agentRuns).values([
          {
            agentType: 'VISION_AGENT',
            entityType: 'EVIDENCE',
            entityId: ev2.id,
            status: 'COMPLETED',
            provider: 'mock',
            model: 'ecopulse-vision-v1',
            inputReference: ev2.mediaUrl,
            outputReference: JSON.stringify({
              category: 'OVERFLOWING_BIN',
              severity: 'HIGH',
              confidence: 91,
              detectedObjects: [
                'overflowing municipal bin',
                'loose plastic packaging',
                'beverage containers',
                'sidewalk obstruction',
              ],
            }),
            metadata: { executionTimeMs: 120 },
          },
          {
            agentType: 'SCORING_AGENT',
            entityType: 'EVIDENCE',
            entityId: ev2.id,
            status: 'COMPLETED',
            provider: 'mock',
            model: 'ecopulse-scoring-v1',
            inputReference: ev2.id,
            outputReference: JSON.stringify({
              recommendation: 'DISPATCH_FIELD_TASK',
              confidence: 91,
              reason: 'Evidence indicates high-density overflowing waste obstructing pedestrian path.',
            }),
            metadata: { executionTimeMs: 45 },
          },
        ]);
      }
    }
  }

  console.log('📋 Seeded reports, evidence, AI reviews, agent runs & tasks.');
  await seedGeography(community.id, maintainerUser.id, demoResidents.length);

  console.log('✅ Seeding completed successfully (DEVELOPMENT DATA ONLY).');
}

function makeEnvelopePolygon(minLng: number, minLat: number, maxLng: number, maxLat: number) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

/**
 * Phase 1 — Geographic foundation demo data.
 * Pune → Kothrud & Deccan Gymkhana wards → 6 clusters with real polygons,
 * weekly metric history, resident membership and report/mission anchoring.
 */
async function seedGeography(communityId: string, maintainerUserId: string, residentCount: number) {
  console.log('🗺  Seeding geographic foundation...');

  const puneBoundary = makeEnvelopePolygon(73.7, 18.4, 73.98, 18.65);
  const cityRes = await pool.query<{ id: string }>(
    `INSERT INTO cities (name, code, state, country, boundary_geojson, center_lat, center_lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ['Pune', 'PUNE', 'Maharashtra', 'India', JSON.stringify(puneBoundary), 18.5204, 73.8567]
  );
  const cityId = cityRes.rows[0].id;

  const wardDefs = [
    { name: 'Kothrud', code: 'KTH', minLng: 73.79, minLat: 18.49, maxLng: 73.83, maxLat: 18.53, cLat: 18.51, cLng: 73.81 },
    { name: 'Deccan Gymkhana', code: 'DEC', minLng: 73.83, minLat: 18.505, maxLng: 73.865, maxLat: 18.53, cLat: 18.5175, cLng: 73.8475 },
  ];

  const wardIds: Record<string, string> = {};
  for (const w of wardDefs) {
    const wardPoly = makeEnvelopePolygon(w.minLng, w.minLat, w.maxLng, w.maxLat);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO wards (city_id, name, code, boundary_geojson, center_lat, center_lng)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (city_id, code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [cityId, w.name, w.code, JSON.stringify(wardPoly), w.cLat, w.cLng]
    );
    wardIds[w.code] = res.rows[0].id;
  }

  const clusterDefs = [
    { code: 'KTH-01', name: 'Kothrud Green Corridor', ward: 'KTH', minLng: 73.795, minLat: 18.495, maxLng: 73.81, maxLat: 18.51, desc: 'Tree-lined walking corridor and composting hub.' },
    { code: 'KTH-02', name: 'Kothrud Market Quarter', ward: 'KTH', minLng: 73.81, minLat: 18.495, maxLng: 73.825, maxLat: 18.51, desc: 'Market streets with high footfall waste generation.' },
    { code: 'KTH-03', name: 'Kothrud Lake Side', ward: 'KTH', minLng: 73.795, minLat: 18.51, maxLng: 73.81, maxLat: 18.525, desc: 'Lake precinct with morning walkers and bird habitat.' },
    { code: 'KTH-04', name: 'Kothrud Sectors 6-9', ward: 'KTH', minLng: 73.81, minLat: 18.51, maxLng: 73.825, maxLat: 18.525, desc: 'Residential sectors with active housing societies.' },
    { code: 'DEC-01', name: 'Deccan Riverfront', ward: 'DEC', minLng: 73.835, minLat: 18.512, maxLng: 73.848, maxLat: 18.522, desc: 'Mutha riverfront promenade and student quarter.' },
    { code: 'DEC-02', name: 'Deccan Heritage Core', ward: 'DEC', minLng: 73.848, minLat: 18.512, maxLng: 73.86, maxLat: 18.522, desc: 'Heritage precinct with cafes and cultural venues.' },
  ];

  const clusterIds: string[] = [];
  for (const c of clusterDefs) {
    const clusterPoly = makeEnvelopePolygon(c.minLng, c.minLat, c.maxLng, c.maxLat);
    const res = await pool.query<{ id: string }>(
      `INSERT INTO clusters
         (community_id, ward_id, code, name, description, boundary_geojson, center_lat, center_lng,
          min_lat, max_lat, min_lng, max_lng, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'ACTIVE')
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id`,
      [
        communityId,
        wardIds[c.ward],
        c.code,
        c.name,
        c.desc,
        JSON.stringify(clusterPoly),
        (c.minLat + c.maxLat) / 2,
        (c.minLng + c.maxLng) / 2,
        c.minLat,
        c.maxLat,
        c.minLng,
        c.maxLng,
      ]
    );
    clusterIds.push(res.rows[0].id);
  }

  // Weekly metric history per cluster (8 weeks, deterministic variation)
  const metricProfile: Record<string, number[]> = {
    'KTH-01': [82, 74, 78, 85],
    'KTH-02': [61, 55, 70, 64],
    'KTH-03': [88, 80, 90, 86],
    'KTH-04': [70, 66, 75, 72],
    'DEC-01': [58, 60, 65, 55],
    'DEC-02': [76, 72, 82, 78],
  };

  const now = Date.now();
  for (let i = 0; i < clusterDefs.length; i++) {
    const def = clusterDefs[i];
    const profile = metricProfile[def.code];
    for (let week = 7; week >= 0; week--) {
      const periodStart = new Date(now - week * 7 * 86400000).toISOString().split('T')[0];
      const wobble = ((def.code.length + week * 3) % 5) - 2; // deterministic -2..2
      const values: Array<[string, number]> = [
        ['environment', profile[0] + wobble],
        ['participation', profile[1] + wobble],
        ['service', profile[2] - Math.floor(week / 4)],
        ['incidents_open', Math.max(0, (5 + wobble) - week % 3)],
        ['progress', Math.min(100, profile[3] + (7 - week) * 2 + wobble)],
      ];
      for (const [key, value] of values) {
        await pool.query(
          `INSERT INTO cluster_metrics (cluster_id, metric_key, metric_value, period_start, recorded_at)
           SELECT $1::uuid, $2::varchar, $3::integer, $4::date, $5::timestamptz
           WHERE NOT EXISTS (
             SELECT 1 FROM cluster_metrics
             WHERE cluster_id = $1::uuid AND metric_key = $2::varchar AND period_start = $4::date
           )`,
          [clusterIds[i], key, Math.round(value), periodStart, new Date(now - week * 7 * 86400000)]
        );
      }
    }
  }

  // Assign seed residents + maintainer to clusters (round-robin over residents)
  const residentRows = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'RESIDENT' ORDER BY created_at LIMIT $1`,
    [residentCount]
  );
  const memberships: Array<[string, string]> = residentRows.rows.map((r, idx) => [
    r.id,
    clusterIds[idx % clusterIds.length],
  ]);
  memberships.push([maintainerUserId, clusterIds[0]]);

  for (const [userId, clusterId] of memberships) {
    await pool.query(
      `INSERT INTO cluster_members (cluster_id, user_id, is_primary)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (cluster_id, user_id) DO NOTHING`,
      [clusterId, userId]
    );
  }

  // Anchor existing reports and missions to their containing clusters
  await pool.query(`
    UPDATE reports r
    SET ward_id = w.id, cluster_id = c.id
    FROM wards w, clusters c
    WHERE r.location_geojson IS NOT NULL
      AND (r.location_geojson->'coordinates'->>1)::float8 BETWEEN c.min_lat AND c.max_lat
      AND (r.location_geojson->'coordinates'->>0)::float8 BETWEEN c.min_lng AND c.max_lng
      AND c.ward_id = w.id
  `);
  // Reports without GeoJSON: anchor by address hint (demo heuristic)
  await pool.query(`
    UPDATE reports r
    SET cluster_id = c.id, ward_id = c.ward_id
    FROM clusters c
    WHERE r.cluster_id IS NULL
      AND c.code = 'DEC-01'
      AND r.location_address ILIKE '%deccan%'
  `);
  await pool.query(`
    UPDATE reports r
    SET cluster_id = c.id, ward_id = c.ward_id
    FROM clusters c
    WHERE r.cluster_id IS NULL
      AND c.code = 'KTH-02'
      AND r.location_address ILIKE '%kothrud%'
  `);

  await pool.query(
    `UPDATE missions SET cluster_id = (SELECT id FROM clusters WHERE code = 'KTH-01') WHERE title = 'Walk the Clean Route'`
  );
  await pool.query(
    `UPDATE missions SET cluster_id = (SELECT id FROM clusters WHERE code = 'DEC-01') WHERE title = 'Report a Waste Hotspot'`
  );
  await pool.query(
    `UPDATE missions SET cluster_id = (SELECT id FROM clusters WHERE code = 'KTH-02') WHERE title = 'Segregate Your Household Waste'`
  );

  console.log(`🗺  Geography seeded: 1 city, ${wardDefs.length} wards, ${clusterDefs.length} clusters, ${memberships.length} memberships.`);
}

if (process.argv[1]?.endsWith('seed.ts')) {
  seed()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
