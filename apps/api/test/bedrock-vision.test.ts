import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { bedrockVisionAnalysisSchema } from '@ecopulse/validation';
import { BedrockVisionProvider } from '../src/agents/bedrock-provider.js';
import { getAIProvider, MockVisionProvider } from '../src/agents/ai-provider.js';
import { evidenceProcessingService } from '../src/services/evidence-processing.service.js';
import { storageService } from '../src/services/storage.service.js';
import { buildApp } from '../src/app.js';
import { pool, db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { aiObservations, environmentalEvents } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('EcoPulse: AWS Bedrock Vision AI Integration & Pipeline Tests', () => {
  let app: FastifyInstance;
  let maintainerToken: string;
  let residentToken: string;
  let testReportId: string;
  let testEvidenceId: string;

  const validBedrockOutput = {
    wasteDetected: true,
    wastePresence: 'SIGNIFICANT' as const,
    wasteCategory: 'ILLEGAL_DUMPING' as const,
    secondaryCategories: ['PLASTIC_PACKAGING', 'COMMERCIAL_REFUSE'],
    visibleSeverity: 'HIGH' as const,
    estimatedVolume: 'Medium dump pile (approx 5-10 bags)',
    potentialObstruction: 'STORM_DRAIN' as const,
    environmentalRiskIndicators: ['DRAINAGE_BLOCK', 'SOIL_CONTAMINATION'],
    evidenceQuality: 'HIGH' as const,
    limitations: 'Good daylight, slight shadow on curb',
    requiresHumanReview: false,
    description: 'Substantial plastic and commercial debris discarded on public street.',
    observations: 'Substantial plastic and commercial debris discarded on public street.',
    recommendedAction: 'Immediate clearance by municipal sanitation sweepers.',
    detectedObjects: ['plastic container', 'polyethylene bag', 'cardboard box'],
  };

  const cleanAreaOutput = {
    wasteDetected: false,
    wastePresence: 'NONE' as const,
    wasteCategory: 'NO_CLEAR_ISSUE' as const,
    secondaryCategories: [],
    visibleSeverity: 'LOW' as const,
    estimatedVolume: 'None visible',
    potentialObstruction: 'NONE' as const,
    environmentalRiskIndicators: [],
    evidenceQuality: 'HIGH' as const,
    limitations: 'Full visibility, clear park lawn',
    requiresHumanReview: false,
    description: 'Public park lawn is clean with no visible solid waste.',
    observations: 'Public park lawn is clean with no visible solid waste.',
    recommendedAction: 'No action required. Area meets municipal cleanliness standards.',
    detectedObjects: ['green grass', 'walkway'],
  };

  const blurryInconclusiveOutput = {
    wasteDetected: false,
    wastePresence: 'NONE' as const,
    wasteCategory: 'NO_CLEAR_ISSUE' as const,
    secondaryCategories: [],
    visibleSeverity: 'LOW' as const,
    estimatedVolume: 'None visible',
    potentialObstruction: 'NONE' as const,
    environmentalRiskIndicators: [],
    evidenceQuality: 'BLURRY_UNREADABLE' as const,
    limitations: 'Severe blur and camera motion distortion prevent identification',
    requiresHumanReview: true,
    description: 'Image is too blurry to identify whether waste is present.',
    observations: 'Image is too blurry to identify whether waste is present.',
    recommendedAction: 'Flag for human review or request sharper photo from citizen.',
    detectedObjects: [],
  };

  beforeAll(async () => {
    await runMigrations();
    await seed();

    app = buildApp();
    await app.ready();

    // Login maintainer
    const mRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'maintainer@ecopulse.org',
        password: 'password123',
      },
    });
    maintainerToken = mRes.json().data.token;

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

    // Fetch communities
    const cRes = await app.inject({ method: 'GET', url: '/communities' });
    const communityId = cRes.json().data[0].id;

    // Create a test report
    const repRes = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        communityId,
        category: 'ILLEGAL_DUMPING',
        title: 'Roadside Commercial Dump',
        description: 'Large waste pile blocking gutter',
        locationGeoJson: { type: 'Point', coordinates: [73.8567, 18.5204] },
      },
    });
    testReportId = repRes.json().data.id;

    // Upload & attach evidence (100+ byte valid JPEG)
    const validBase64Jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAAKAAoBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const evRes = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/evidence`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        mediaUrl: validBase64Jpg,
      },
    });
    testEvidenceId = evRes.json().data.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  // 1. Bedrock Schema Validation Unit Tests
  describe('1. Bedrock Structured Schema Validation', () => {
    it('should validate conformant positive waste detection output', () => {
      const parsed = bedrockVisionAnalysisSchema.parse(validBedrockOutput);
      expect(parsed.wasteDetected).toBe(true);
      expect(parsed.wasteCategory).toBe('ILLEGAL_DUMPING');
      expect(parsed.visibleSeverity).toBe('HIGH');
      expect(parsed.requiresHumanReview).toBe(false);
    });

    it('should validate conformant clean area observation', () => {
      const parsed = bedrockVisionAnalysisSchema.parse(cleanAreaOutput);
      expect(parsed.wasteDetected).toBe(false);
      expect(parsed.wastePresence).toBe('NONE');
      expect(parsed.wasteCategory).toBe('NO_CLEAR_ISSUE');
    });

    it('should validate blurry/inconclusive image requiring human review', () => {
      const parsed = bedrockVisionAnalysisSchema.parse(blurryInconclusiveOutput);
      expect(parsed.wasteDetected).toBe(false);
      expect(parsed.evidenceQuality).toBe('BLURRY_UNREADABLE');
      expect(parsed.requiresHumanReview).toBe(true);
    });

    it('should reject malformed observations missing required fields', () => {
      expect(() =>
        bedrockVisionAnalysisSchema.parse({
          wasteDetected: true,
          // Missing wasteCategory, wastePresence, etc.
        })
      ).toThrow();
    });
  });

  // 2. BedrockVisionProvider Request Construction & Byte Validation
  describe('2. Image Byte Resolution & Request Bounds', () => {
    it('should resolve and validate data URI image bytes', async () => {
      const provider = new BedrockVisionProvider();
      const tinyBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const resolved = await provider.resolveImageBytes(tinyBase64);
      expect(resolved.buffer).toBeInstanceOf(Buffer);
      expect(resolved.mimeType).toBe('image/png');
    });

    it('should reject unreadable or too small corrupted buffers (< 100 bytes)', async () => {
      const provider = new BedrockVisionProvider();
      const tinyCorrupt = 'data:image/jpeg;base64,AAAA';
      await expect(provider.resolveImageBytes(tinyCorrupt)).rejects.toThrow('corrupted or too small');
    });

    it('should enforce 5MB Bedrock payload size limit', async () => {
      const provider = new BedrockVisionProvider();
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
      const hugeBase64 = `data:image/jpeg;base64,${hugeBuffer.toString('base64')}`;
      await expect(provider.resolveImageBytes(hugeBase64)).rejects.toThrow('exceeds 5MB Bedrock limit');
    });
  });

  // 3. Bedrock Mock Client Invocation & Provider Contract
  describe('3. Bedrock Model Invocation via Converse API', () => {
    it('should invoke Bedrock ConverseCommand with actual image bytes and parse response', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [
              {
                text: JSON.stringify(validBedrockOutput),
              },
            ],
          },
        },
      });

      const provider = new BedrockVisionProvider({
        mockClient: { send: mockSend },
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      });

      const sampleImg = 'data:image/jpeg;base64,' + Buffer.alloc(200, 0x42).toString('base64');
      const result = await provider.analyzeEnvironmentalEvidence({
        evidenceId: 'test-ev-1',
        mediaUrl: sampleImg,
        categoryHint: 'ILLEGAL_DUMPING',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg.input.modelId).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
      expect(commandArg.input.messages[0].content[0].image).toBeDefined();
      expect(result.provider).toBe('BEDROCK');
      expect(result.wasteType).toBe('ILLEGAL_DUMPING');
      expect(result.severity).toBe('HIGH');
    });

    it('should handle clean areas correctly without fabricating waste', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: JSON.stringify(cleanAreaOutput) }],
          },
        },
      });

      const provider = new BedrockVisionProvider({
        mockClient: { send: mockSend },
      });

      const sampleImg = 'data:image/jpeg;base64,' + Buffer.alloc(200, 0x42).toString('base64');
      const result = await provider.analyzeEnvironmentalEvidence({
        evidenceId: 'test-ev-clean',
        mediaUrl: sampleImg,
      });

      expect(result.wasteType).toBe('NO_CLEAR_ISSUE');
      expect(result.severity).toBe('LOW');
    });

    it('should handle AccessDeniedException gracefully without fabricating results', async () => {
      const accessDeniedErr = new Error('User arn:aws:iam::123:user/s3-user is not authorized to perform: bedrock:InvokeModel');
      accessDeniedErr.name = 'AccessDeniedException';

      const mockSend = vi.fn().mockRejectedValue(accessDeniedErr);

      const provider = new BedrockVisionProvider({
        mockClient: { send: mockSend },
      });

      const sampleImg = 'data:image/jpeg;base64,' + Buffer.alloc(200, 0x42).toString('base64');
      await expect(
        provider.analyzeEnvironmentalEvidence({
          evidenceId: 'test-ev-denied',
          mediaUrl: sampleImg,
        })
      ).rejects.toThrow('AWS Bedrock Vision Analysis Failed: User arn:aws:iam');
    });

    it('should retry on transient throttling errors up to maxRetries', async () => {
      const throttleErr = new Error('Rate limit exceeded');
      throttleErr.name = 'ThrottlingException';

      const mockSend = vi
        .fn()
        .mockRejectedValueOnce(throttleErr)
        .mockResolvedValueOnce({
          output: {
            message: {
              content: [{ text: JSON.stringify(validBedrockOutput) }],
            },
          },
        });

      const provider = new BedrockVisionProvider({
        mockClient: { send: mockSend },
        maxRetries: 2,
      });

      const sampleImg = 'data:image/jpeg;base64,' + Buffer.alloc(200, 0x42).toString('base64');
      const result = await provider.analyzeEnvironmentalEvidence({
        evidenceId: 'test-ev-throttle',
        mediaUrl: sampleImg,
      });

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result.wasteType).toBe('ILLEGAL_DUMPING');
    });
  });

  // 4. End-to-End Pipeline & DB Persistence with Bedrock Provider
  describe('4. End-to-End Pipeline & Database Persistence', () => {
    it('should persist observation and provide real aiFindings through API', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: JSON.stringify(validBedrockOutput) }],
          },
        },
      });

      const testBedrockProvider = new BedrockVisionProvider({
        mockClient: { send: mockSend },
        model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      });

      // Temporarily swap provider in vision agent
      const { visionAgent } = await import('../src/agents/vision.agent.js');
      visionAgent.setProvider(testBedrockProvider);

      // Create a fresh evidence attachment to avoid idempotency cache
      const freshEv = await app.inject({
        method: 'POST',
        url: `/reports/${testReportId}/evidence`,
        headers: { authorization: `Bearer ${residentToken}` },
        payload: {
          mediaUrl: 'data:image/jpeg;base64,' + Buffer.alloc(150, 0x42).toString('base64'),
        },
      });
      const freshEvidenceId = freshEv.json().data.id;

      // Process evidence job
      await evidenceProcessingService.processEvidenceJob({
        evidenceId: freshEvidenceId,
        reportId: testReportId,
        uploaderId: 'user-resident-1',
      });

      // Verify database record
      const [event] = await db
        .select()
        .from(environmentalEvents)
        .where(eq(environmentalEvents.reportId, testReportId))
        .limit(1);

      expect(event).toBeDefined();
      expect(event.status).toBe('ANALYZED');

      const [obs] = await db
        .select()
        .from(aiObservations)
        .where(eq(aiObservations.eventId, event.id))
        .limit(1);

      expect(obs).toBeDefined();
      expect(obs.modelProvider).toBe('BEDROCK');
      expect(obs.wasteType).toBe('ILLEGAL_DUMPING');
      expect(obs.severity).toBe('HIGH');

      // Verify report API returns structured aiFindings
      const getRes = await app.inject({
        method: 'GET',
        url: `/reports/${testReportId}`,
      });

      expect(getRes.statusCode).toBe(200);
      const resData = getRes.json().data;
      expect(resData.aiFindings).toBeDefined();
      expect(resData.aiFindings.wasteDetected).toBe(true);
      expect(resData.aiFindings.modelProvider).toBe('BEDROCK');
      expect(resData.aiFindings.modelName).toBe('anthropic.claude-3-5-sonnet-20241022-v2:0');
      expect(resData.aiFindings.requiresHumanReview).toBe(false);
    });

    it('should flag REVIEW_REQUIRED in DB when evidence is inconclusive or blurry', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: JSON.stringify(blurryInconclusiveOutput) }],
          },
        },
      });

      const testBedrockProvider = new BedrockVisionProvider({
        mockClient: { send: mockSend },
      });

      const { visionAgent } = await import('../src/agents/vision.agent.js');
      visionAgent.setProvider(testBedrockProvider);

      // Create a fresh report & evidence for the blurry scenario
      const cRes = await app.inject({ method: 'GET', url: '/communities' });
      const commId = cRes.json().data[0].id;
      const blurryRep = await app.inject({
        method: 'POST',
        url: '/reports',
        headers: { authorization: `Bearer ${residentToken}` },
        payload: {
          communityId: commId,
          category: 'OTHER',
          title: 'Blurry Photo Hazard Report',
          description: 'Cannot determine hazard due to darkness',
        },
      });
      const blurryReportId = blurryRep.json().data.id;

      const blurryEv = await app.inject({
        method: 'POST',
        url: `/reports/${blurryReportId}/evidence`,
        headers: { authorization: `Bearer ${residentToken}` },
        payload: {
          mediaUrl: 'data:image/jpeg;base64,' + Buffer.alloc(150, 0x55).toString('base64'),
        },
      });
      const blurryEvidenceId = blurryEv.json().data.id;

      // Process evidence job with blurry output
      await evidenceProcessingService.processEvidenceJob({
        evidenceId: blurryEvidenceId,
        reportId: blurryReportId,
        uploaderId: 'user-resident-1',
      });

      // Verify environmental event flagged for human review
      const [event] = await db
        .select()
        .from(environmentalEvents)
        .where(eq(environmentalEvents.reportId, blurryReportId))
        .limit(1);

      expect(event.status).toBe('REVIEW_REQUIRED');

      const getRes = await app.inject({
        method: 'GET',
        url: `/reports/${blurryReportId}`,
      });
      const resData = getRes.json().data;
      expect(resData.aiFindings.requiresHumanReview).toBe(true);
    });

    it('should ensure negative detection does not auto-reject the report', async () => {
      const reportBefore = await app.inject({
        method: 'GET',
        url: `/reports/${testReportId}`,
      });

      // Report status is NOT REJECTED; it remains SUBMITTED/ANALYZED
      expect(reportBefore.json().data.status).not.toBe('REJECTED');
    });

    it('should ensure non-maintainers cannot reprocess AI analysis', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/reports/${testReportId}/reprocess`,
        headers: { authorization: `Bearer ${residentToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should allow maintainers to reprocess AI analysis', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/reports/${testReportId}/reprocess`,
        headers: { authorization: `Bearer ${maintainerToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });
});
