/**
 * EcoPulse Environmental Operations Center - Realistic Demo Seed Dataset
 * 
 * Generates realistic development records for Pune Municipal Corporation (PMC).
 * These records are explicitly tagged as [DEMO-SEED] and will not run in production.
 */

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../apps/api/src/db/schema.js';
import { MockEmbeddingProvider } from '../../apps/api/src/ai/embedding-provider.js';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecopulse';

const pool = new pg.Pool({ connectionString });
const db = drizzle(pool, { schema });
const embeddingProvider = new MockEmbeddingProvider();

export async function seedEnvironmentalDemo() {
  console.log('🌍 [SEED] Seeding EcoPulse Environmental Operations Center demo records...');

  if (process.env.NODE_ENV === 'production') {
    console.error('⛔ Refusing to run development demo seed in production!');
    return;
  }

  // 1. Pune Municipal Hotspots
  const hotspot1Id = randomUUID();
  const hotspot2Id = randomUUID();
  const hotspot3Id = randomUUID();

  await db.insert(schema.hotspots).values([
    {
      id: hotspot1Id,
      dominantWasteType: 'Plastic Packaging Accumulation',
      centerLatitude: 18.5089,
      centerLongitude: 73.8184, // Kothrud Paud Road
      radius: 350,
      reportCount: 14,
      averageSeverity: 3.8,
      trend: 'INCREASING',
      score: 88.5,
      status: 'ACTIVE',
      firstDetectedAt: new Date(Date.now() - 14 * 86400000),
      lastDetectedAt: new Date(),
    },
    {
      id: hotspot2Id,
      dominantWasteType: 'Illegal Construction Debris Offloading',
      centerLatitude: 18.5590,
      centerLongitude: 73.7868, // Baner Pashan Link
      radius: 450,
      reportCount: 9,
      averageSeverity: 3.4,
      trend: 'CRITICAL',
      score: 79.2,
      status: 'ACTIVE',
      firstDetectedAt: new Date(Date.now() - 21 * 86400000),
      lastDetectedAt: new Date(Date.now() - 1 * 86400000),
    },
    {
      id: hotspot3Id,
      dominantWasteType: 'Commercial Wet Waste Overflow',
      centerLatitude: 18.5018,
      centerLongitude: 73.8636, // Swargate Market
      radius: 200,
      reportCount: 18,
      averageSeverity: 2.9,
      trend: 'STABLE',
      score: 74.0,
      status: 'ACTIVE',
      firstDetectedAt: new Date(Date.now() - 30 * 86400000),
      lastDetectedAt: new Date(Date.now() - 2 * 86400000),
    },
  ]).onConflictDoNothing();

  console.log('✅ Seeded 3 Pune Hotspots');

  // 2. Environmental Events & AI Observations
  const demoEvents = [
    {
      desc: '[DEMO-SEED] Curbside single-use plastic dumping near stormwater culvert',
      lat: 18.5085,
      lng: 73.8182,
      wasteType: 'Plastic Packaging Accumulation',
      severity: 'CRITICAL',
      vol: 'High (~25 kg)',
      risk: 'Stormwater blockage hazard prior to monsoon',
      safety: 'Medium - vector breeding',
      dumpingProb: 0.92,
      action: 'Deploy emergency clearing team and place waste surveillance warning board.',
    },
    {
      desc: '[DEMO-SEED] Reinforced concrete rubble and tile debris dumped along bypass road',
      lat: 18.5588,
      lng: 73.7871,
      wasteType: 'Construction Debris',
      severity: 'HIGH',
      vol: 'Very High (~200 kg)',
      risk: 'Roadway encroachment and pedestrian hazard',
      safety: 'High - vehicular collision danger',
      dumpingProb: 0.98,
      action: 'Dispatch earth-moving loader and levy municipal enforcement fine.',
    },
    {
      desc: '[DEMO-SEED] Vegetable market organic waste overflowing municipal green bin',
      lat: 18.5021,
      lng: 73.8640,
      wasteType: 'Organic / Wet Waste',
      severity: 'HIGH',
      vol: 'High (~50 kg)',
      risk: 'Severe odor and bio-decomposition contamination',
      safety: 'Moderate - pest attractant',
      dumpingProb: 0.15,
      action: 'Route secondary collection compactor truck and increase pickup frequency.',
    },
    {
      desc: '[DEMO-SEED] Mixed municipal packaging and beverage cans discarded in public park',
      lat: 18.5204,
      lng: 73.8567,
      wasteType: 'Mixed Domestic Waste',
      severity: 'MEDIUM',
      vol: 'Moderate (~10 kg)',
      risk: 'Soil pollution and aesthetic degradation',
      safety: 'Low',
      dumpingProb: 0.35,
      action: 'Assign ward sanitation sweeper and install twin segregation bins.',
    },
    {
      desc: '[DEMO-SEED] Unsegregated cardboard and polystyrene packaging behind commercial complex',
      lat: 18.5308,
      lng: 73.8474,
      wasteType: 'Packaging Materials',
      severity: 'MEDIUM',
      vol: 'Moderate (~15 kg)',
      risk: 'Fire hazard during dry afternoons',
      safety: 'Moderate fire risk',
      dumpingProb: 0.75,
      action: 'Issue commercial compliance notice to retail strip management.',
    },
    {
      desc: '[DEMO-SEED] Discarded electronic components and broken lithium battery casing',
      lat: 18.5142,
      lng: 73.8291,
      wasteType: 'E-Waste / Hazardous',
      severity: 'CRITICAL',
      vol: 'Small (~3 kg)',
      risk: 'Heavy metal leaching into roadside soil',
      safety: 'High toxic contamination risk',
      dumpingProb: 0.88,
      action: 'Specialized hazardous waste containment and recycling pickup.',
    },
    {
      desc: '[DEMO-SEED] Medical blister packs and expired pharmaceutical containers in alley',
      lat: 18.5045,
      lng: 73.8522,
      wasteType: 'Bio-Medical Waste',
      severity: 'CRITICAL',
      vol: 'Low (~2 kg)',
      risk: 'Pathogen exposure and groundwater chemical infiltration',
      safety: 'Severe biological hazard',
      dumpingProb: 0.95,
      action: 'Escalate to PMC Health Officer for immediate biohazard quarantine.',
    },
    {
      desc: '[DEMO-SEED] Plastic water bottles and food wrappers discarded near bus stop',
      lat: 18.5230,
      lng: 73.8744,
      wasteType: 'Plastic Packaging Accumulation',
      severity: 'LOW',
      vol: 'Low (~2 kg)',
      risk: 'Minor littering',
      safety: 'Low',
      dumpingProb: 0.05,
      action: 'Routine morning sweeping sweep.',
    },
  ];

  for (const item of demoEvents) {
    const eventId = randomUUID();
    await db.insert(schema.environmentalEvents).values({
      id: eventId,
      description: item.desc,
      latitude: item.lat,
      longitude: item.lng,
      status: 'VERIFIED',
      source: 'CITIZEN_REPORT',
      eventType: 'WASTE_HOTSPOT',
      severity: item.severity,
      createdAt: new Date(),
      detectedAt: new Date(),
    });

    await db.insert(schema.aiObservations).values({
      id: randomUUID(),
      eventId,
      modelProvider: 'local-vision-v1',
      modelName: 'ecopulse-yolov8-custom',
      wasteType: item.wasteType,
      severity: item.severity,
      confidence: 0.94,
      estimatedVolume: item.vol,
      environmentalRisk: item.risk,
      publicSafetyRisk: item.safety,
      illegalDumpingLikelihood: item.dumpingProb,
      recommendedAction: item.action,
    });

    const vec = await embeddingProvider.embedText(`${item.desc} ${item.wasteType} ${item.risk}`);
    await db.insert(schema.environmentalEmbeddings).values({
      id: randomUUID(),
      eventId,
      provider: 'mock-titan',
      model: 'titan-embed-text-v1',
      modality: 'TEXT',
      dimensions: 384,
      vector: vec,
    });
  }

  console.log(`✅ Seeded ${demoEvents.length} Environmental Events, Observations, and pgvector Embeddings`);

  // 3. Seed Interventions
  const inv1Id = randomUUID();
  const inv2Id = randomUUID();
  const inv3Id = randomUUID();

  await db.insert(schema.interventions).values([
    {
      id: inv1Id,
      hotspotId: hotspot1Id,
      type: 'Curbside Plastic Clean-up & Twin Bin Installation',
      priority: 'high',
      status: 'completed',
      assignedTeam: 'PMC Sanitation Rapid Response Team 3',
      notes: '[DEMO-SEED] Waste fully desilted and 200L segregation receptacles deployed.',
      createdAt: new Date(Date.now() - 14 * 86400000),
      startedAt: new Date(Date.now() - 13 * 86400000),
      completedAt: new Date(Date.now() - 12 * 86400000),
    },
    {
      id: inv2Id,
      hotspotId: hotspot2Id,
      type: 'CCTV Deployment & Anti-Dumping Signage',
      priority: 'critical',
      status: 'in_progress',
      assignedTeam: 'PMC Enforcement Division',
      notes: '[DEMO-SEED] Solar-powered night surveillance camera installed facing Pashan link.',
      createdAt: new Date(Date.now() - 4 * 86400000),
      startedAt: new Date(Date.now() - 3 * 86400000),
    },
    {
      id: inv3Id,
      hotspotId: hotspot3Id,
      type: 'Twice-Daily Market Organic Compactor Pickup',
      priority: 'medium',
      status: 'approved',
      assignedTeam: 'Swargate Zone Logistics',
      notes: '[DEMO-SEED] Approved by Supervisor Patil. Scheduled for vehicle allocation.',
      createdAt: new Date(Date.now() - 1 * 86400000),
    },
  ]).onConflictDoNothing();

  // 4. Seed Verified Longitudinal Outcomes
  await db.insert(schema.interventionOutcomes).values([
    {
      id: randomUUID(),
      interventionId: inv1Id,
      beforeReportRate: 18,
      afterReportRate: 4,
      beforeSeverity: 3.8,
      afterSeverity: 1.2,
      beforeHotspotSize: 350,
      afterHotspotSize: 95,
      successScore: 0.842,
      measuredAt: new Date(),
    },
  ]).onConflictDoNothing();

  console.log('✅ Seeded Interventions and Longitudinal Outcomes');
  console.log('🎉 Environmental Operations demo seed completed successfully!');
}

// Allow direct CLI execution: tsx scripts/seed/environmental-demo.ts
if (process.argv[1]?.endsWith('environmental-demo.ts')) {
  seedEnvironmentalDemo()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed failure:', err);
      pool.end();
      process.exit(1);
    });
}
