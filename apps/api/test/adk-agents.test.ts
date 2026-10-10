import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { dumpingAnalysisSchema, scoringAnalysisSchema } from '@ecopulse/validation';
import type { VisionObservation } from '@ecopulse/types';
import { dumpingAnalysisAgent } from '../src/agents/adk-dumping.agent.js';
import { scoringAgent } from '../src/agents/scoring.agent.js';
import {
  calculatePriorityScoreTool,
  checkHotspotHistoryTool,
  evaluateSafetyGuardrailsTool,
} from '../src/agents/adk-tools.js';
import { evidenceProcessingService } from '../src/services/evidence-processing.service.js';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

describe('EcoPulse: Google ADK Dumping & Scoring Agents', () => {
  let app: FastifyInstance;
  let residentToken: string;
  let testReportId: string;
  let testEvidenceId: string;

  const mockObservation: VisionObservation = {
    evidenceId: '11111111-1111-1111-1111-111111111111',
    category: 'ILLEGAL_DUMPING',
    severity: 'HIGH',
    confidence: 0.92,
    observations: 'Multiple industrial bags and discarded plastic rubble along embankment.',
    detectedObjects: ['heavy waste bags', 'rubble', 'plastic sheeting'],
    model: 'gemini-2.5-flash-lite',
    provider: 'GEMINI' as any,
    processingDurationMs: 450,
    createdAt: new Date().toISOString(),
    ...( {
      geminiAnalysis: {
        wasteDetected: true,
        wastePresence: 'SIGNIFICANT',
        wasteCategory: 'ILLEGAL_DUMPING',
        secondaryCategories: ['CONSTRUCTION_DEBRIS'],
        visibleSeverity: 'HIGH',
        estimatedVolume: 'Large dump pile (~10-15 bags)',
        potentialObstruction: 'STORM_DRAIN',
        environmentalRiskIndicators: ['DRAINAGE_BLOCK', 'SOIL_CONTAMINATION'],
        evidenceQuality: 'HIGH',
        limitations: 'Good natural lighting',
        requiresHumanReview: false,
        description: 'Substantial dumping blocking storm drain.',
        recommendedAction: 'Immediate clearance and surveillance camera proposal.',
        detectedObjects: ['heavy bags', 'debris'],
      },
    } as any),
  };

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // Login resident
    const rRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'priya.sharma@example.com',
        password: 'password123',
      },
    });
    residentToken = rRes.json().data.token;

    // Fetch community
    const cRes = await app.inject({ method: 'GET', url: '/communities' });
    const communityId = cRes.json().data[0].id;

    // Create report
    const repRes = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        communityId,
        category: 'ILLEGAL_DUMPING',
        title: 'Massive Waste Dumping in Gutter',
        description: 'Large commercial bags dumped into stormwater channel',
        locationGeoJson: { type: 'Point', coordinates: [73.8567, 18.5204] },
      },
    });
    testReportId = repRes.json().data.id;

    // Attach evidence
    const tinyBase64Jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const evRes = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/evidence`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { mediaUrl: tinyBase64Jpg },
    });
    testEvidenceId = evRes.json().data.id;
  });

  afterAll(async () => {
    await new Promise((r) => setTimeout(r, 300));
    await app.close();
    await pool.end();
  });

  // 1. ADK Tool Tests
  it('1. checkHotspotHistoryTool should query spatial context and repeat violation risk', async () => {
    const history = await checkHotspotHistoryTool(18.5204, 73.8567, 1000);
    expect(history).toBeDefined();
    expect(typeof history.nearbyEventCount).toBe('number');
    expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL_REPEAT_HOTSPOT']).toContain(history.repeatRisk);
  });

  it('2. calculatePriorityScoreTool should compute auditable multi-factor priority score', () => {
    const calculated = calculatePriorityScoreTool({
      severity: 'HIGH',
      dumpingLikelihood: 0.85,
      potentialObstruction: 'STORM_DRAIN',
      environmentalRiskIndicators: ['DRAINAGE_BLOCK'],
      repeatLocationRisk: 'HIGH',
    });

    expect(calculated.priorityScore).toBeGreaterThanOrEqual(60);
    expect(['HIGH', 'CRITICAL']).toContain(calculated.priorityLevel);
    expect(['WITHIN_24H', 'IMMEDIATE_4H']).toContain(calculated.urgencyTimeframe);
    expect(calculated.recommendedPointsReward).toBe(35);
    expect(calculated.riskFactorBreakdown).toBeDefined();
  });

  it('3. evaluateSafetyGuardrailsTool should enforce human verification when quality is low', () => {
    const guardrail = evaluateSafetyGuardrailsTool({
      evidenceQuality: 'BLURRY_UNREADABLE',
      confidence: 0.65,
      limitations: 'Severe night time darkness and blur',
    });

    expect(guardrail.requiresHumanReview).toBe(true);
    expect(guardrail.guardrailTriggers.length).toBeGreaterThanOrEqual(2);
  });

  // 2. Dumping Analysis Agent Tests
  it('4. DumpingAnalysisAgent should analyze illegal dumping patterns and validate with schema', async () => {
    const dumping = await dumpingAnalysisAgent.analyze({
      evidenceId: testEvidenceId,
      reportId: testReportId,
      observation: mockObservation,
      latitude: 18.5204,
      longitude: 73.8567,
    });

    const parsed = dumpingAnalysisSchema.safeParse(dumping);
    expect(parsed.success).toBe(true);
    expect(dumping.dumpingLikelihood).toBeGreaterThanOrEqual(0.7);
    expect(dumping.drainageRunoffRisk).toBe(true);
    expect(dumping.deterrenceStrategy).toBeDefined();
  });

  // 3. Scoring Agent Tests
  it('5. ScoringAgent should synthesize dumping analysis and vision into municipal recommendation', async () => {
    const ev2 = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/evidence`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: { mediaUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=' },
    });
    const customEvidenceId = ev2.json().data.id;

    const dumping = await dumpingAnalysisAgent.analyze({
      evidenceId: customEvidenceId,
      observation: { ...mockObservation, evidenceId: customEvidenceId },
      latitude: 18.5204,
      longitude: 73.8567,
    });

    const recommendation = await scoringAgent.generateRecommendation({
      entityType: 'REPORT',
      entityId: testReportId,
      observation: { ...mockObservation, evidenceId: customEvidenceId },
      dumpingAnalysis: dumping,
    });

    expect(recommendation).toBeDefined();
    expect(recommendation.recommendation).toBe('DISPATCH_FIELD_TASK');
    expect(recommendation.priorityScore).toBeDefined();
    expect(recommendation.scoringAnalysis).toBeDefined();

    const parsedScoring = scoringAnalysisSchema.safeParse(recommendation.scoringAnalysis);
    expect(parsedScoring.success).toBe(true);
  });

  // 4. End-to-end Pipeline Verification
  it('6. Evidence processing pipeline should execute all agents and persist enriched observations', async () => {
    await evidenceProcessingService.processEvidenceJob({
      evidenceId: testEvidenceId,
      reportId: testReportId,
      uploaderId: 'test-resident-1',
    });

    const res = await pool.query(
      `SELECT o.raw_metadata, o.illegal_dumping_likelihood, e.status
       FROM ai_observations o
       JOIN environmental_events e ON e.id = o.event_id
       WHERE e.report_id = $1 LIMIT 1`,
      [testReportId]
    );

    expect(res.rows.length).toBe(1);
    const row = res.rows[0];
    const raw = row.raw_metadata;

    expect(raw).toBeDefined();
    expect(raw.dumpingAnalysis).toBeDefined();
    expect(raw.scoringAnalysis).toBeDefined();
    expect(Number(row.illegal_dumping_likelihood)).toBeGreaterThanOrEqual(0.5);
  });
});
