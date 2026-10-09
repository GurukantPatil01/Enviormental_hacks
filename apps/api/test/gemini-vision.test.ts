import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { geminiVisionAnalysisSchema } from '@ecopulse/validation';
import { GeminiVisionProvider } from '../src/agents/gemini-provider.js';
import { MockVisionProvider, getAIProvider } from '../src/agents/ai-provider.js';
import { evidenceProcessingService } from '../src/services/evidence-processing.service.js';
import { storageService } from '../src/services/storage.service.js';
import { buildApp } from '../src/app.js';
import { pool } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

// Mock @google/genai SDK
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGenerateContent,
      },
    })),
  };
});

describe('EcoPulse: Gemini Vision AI Integration & Pipeline Tests', () => {
  let app: FastifyInstance;
  let maintainerToken: string;
  let residentToken: string;
  let testReportId: string;
  let testEvidenceId: string;

  const validGeminiOutput = {
    wasteDetected: true,
    wastePresence: 'SIGNIFICANT' as const,
    wasteCategory: 'ILLEGAL_DUMPING' as const,
    secondaryCategories: ['PLASTIC_PACKAGING'],
    visibleSeverity: 'HIGH' as const,
    estimatedVolume: 'Medium dump pile (approx 5-10 bags)',
    potentialObstruction: 'STORM_DRAIN' as const,
    environmentalRiskIndicators: ['WATER_SOURCE_PROXIMITY', 'DRAINAGE_BLOCK'],
    evidenceQuality: 'HIGH' as const,
    limitations: 'Clear day lighting, unoccluded view',
    requiresHumanReview: false,
    description: 'Substantial plastic debris clogging stormwater inlet.',
    recommendedAction: 'Immediate drainage clearance required to prevent flooding.',
    detectedObjects: ['plastic bottle', 'polyethylene bag'],
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
        title: 'Plastic Pile Near Drainage',
        description: 'Large waste pile blocking gutter',
        locationGeoJson: { type: 'Point', coordinates: [73.8567, 18.5204] },
      },
    });
    testReportId = repRes.json().data.id;

    // Upload & attach evidence
    const tinyBase64Jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const evRes = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/evidence`,
      headers: { authorization: `Bearer ${residentToken}` },
      payload: {
        mediaUrl: tinyBase64Jpg,
      },
    });
    testEvidenceId = evRes.json().data.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Schema Validation Unit Tests
  it('1. should validate correct Gemini structured output with zod schema', () => {
    const parseResult = geminiVisionAnalysisSchema.safeParse(validGeminiOutput);
    expect(parseResult.success).toBe(true);
    if (parseResult.success) {
      expect(parseResult.data.wasteCategory).toBe('ILLEGAL_DUMPING');
      expect(parseResult.data.visibleSeverity).toBe('HIGH');
      expect(parseResult.data.potentialObstruction).toBe('STORM_DRAIN');
    }
  });

  it('2. should reject invalid structured responses violating schema', () => {
    const invalidOutput = {
      ...validGeminiOutput,
      visibleSeverity: 'SUPER_EXTREME_INVALID', // invalid enum
    };
    const parseResult = geminiVisionAnalysisSchema.safeParse(invalidOutput);
    expect(parseResult.success).toBe(false);
  });

  // 2. Provider Credentials and Mock Mode Fallback
  it('3. should safely fall back to MockVisionProvider when no GEMINI_API_KEY is configured', () => {
    const origKey = process.env.GEMINI_API_KEY;
    const origProv = process.env.VISION_PROVIDER;

    try {
      delete process.env.GEMINI_API_KEY;
      process.env.VISION_PROVIDER = 'gemini';

      const provider = getAIProvider();
      expect(provider).toBeInstanceOf(MockVisionProvider);
      expect(provider.getProviderName()).toBe('MOCK');
    } finally {
      process.env.GEMINI_API_KEY = origKey;
      process.env.VISION_PROVIDER = origProv;
    }
  });

  // 3. Gemini Vision Provider Execution & Response Parsing
  it('4. should send image bytes to Gemini and parse structured analysis', async () => {
    const provider = new GeminiVisionProvider({
      apiKey: 'test-fake-gemini-key',
      model: 'gemini-2.5-flash-lite',
    });

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(validGeminiOutput),
    });

    const tinyBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const result = await provider.analyzeImage(tinyBase64, {
      categoryHint: 'ILLEGAL_DUMPING',
      locationAddress: 'Shivajinagar, Pune',
    });

    expect(result.provider).toBe('GEMINI');
    expect(result.model).toBe('gemini-2.5-flash-lite');
    expect(result.wasteType).toBe('ILLEGAL_DUMPING');
    expect(result.severity).toBe('HIGH');
    expect(result.geminiAnalysis).toBeDefined();
    expect(result.geminiAnalysis?.requiresHumanReview).toBe(false);
  });

  // 4. Rate Limits & Transient Retry Logic
  it('5. should retry with backoff on rate limits (429) and succeed', async () => {
    const provider = new GeminiVisionProvider({
      apiKey: 'test-fake-gemini-key',
      model: 'gemini-2.5-flash-lite',
      maxRetries: 2,
    });

    // First attempt fails with 429, second succeeds
    mockGenerateContent
      .mockRejectedValueOnce(new Error('Resource has been exhausted (e.g. check quota) - 429'))
      .mockResolvedValueOnce({
        text: JSON.stringify(validGeminiOutput),
      });

    const tinyBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    const result = await provider.analyzeImage(tinyBase64);
    expect(result.wasteType).toBe('ILLEGAL_DUMPING');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  // 5. Terminal Failures & Retry Limits
  it('6. should throw terminal error and not fabricate results when retries are exhausted', async () => {
    const provider = new GeminiVisionProvider({
      apiKey: 'test-fake-gemini-key',
      model: 'gemini-2.5-flash-lite',
      maxRetries: 1,
    });

    mockGenerateContent.mockRejectedValue(new Error('Persistent API Error: 500'));

    const tinyBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

    await expect(provider.analyzeImage(tinyBase64)).rejects.toThrow(
      'Gemini Vision analysis failed'
    );
  });

  // 6. Inconclusive Evidence & Human Review Flagging
  it('7. should flag REVIEW_REQUIRED on low evidence quality or ambiguity', async () => {
    const ambiguousGeminiOutput = {
      ...validGeminiOutput,
      evidenceQuality: 'BLURRY_UNREADABLE' as const,
      requiresHumanReview: true,
      limitations: 'Severe motion blur, nighttime capture with insufficient lighting',
    };

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify(ambiguousGeminiOutput),
    });

    const provider = new GeminiVisionProvider({
      apiKey: 'test-fake-gemini-key',
      model: 'gemini-2.5-flash-lite',
    });

    const tinyBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    const result = await provider.analyzeImage(tinyBase64);

    expect(result.geminiAnalysis?.requiresHumanReview).toBe(true);
    expect(result.geminiAnalysis?.evidenceQuality).toBe('BLURRY_UNREADABLE');
    expect(result.geminiAnalysis?.limitations).toContain('motion blur');
  });

  // 7. S3 / Storage Retrieval Handling
  it('8. should cleanly handle missing private storage keys without crashing', async () => {
    const provider = new GeminiVisionProvider({
      apiKey: 'test-fake-gemini-key',
      model: 'gemini-2.5-flash-lite',
    });

    // Mock storageService.getObject to return null
    const origGetObject = storageService.getObject;
    storageService.getObject = vi.fn().mockResolvedValue(null);

    try {
      await expect(
        provider.analyzeImage('https://s3.amazonaws.com/ecopulse-evidence-dev/reports/evidence/non-existent.jpg')
      ).rejects.toThrow('Image data is empty or corrupted');
    } finally {
      storageService.getObject = origGetObject;
    }
  });


  // 8. Pipeline Idempotency on Duplicate Event Delivery
  it('9. should handle duplicate job delivery idempotently without duplicating observation rows', async () => {
    // Process evidence job 1
    await evidenceProcessingService.processEvidenceJob({
      evidenceId: testEvidenceId,
      reportId: testReportId,
      uploaderId: 'test-resident-id',
    });

    const obsCountRes1 = await pool.query(
      `SELECT COUNT(*)::int as count FROM ai_observations o
       JOIN environmental_events e ON e.id = o.event_id
       WHERE e.report_id = $1`,
      [testReportId]
    );

    // Process duplicate job 2
    await evidenceProcessingService.processEvidenceJob({
      evidenceId: testEvidenceId,
      reportId: testReportId,
      uploaderId: 'test-resident-id',
    });

    const obsCountRes2 = await pool.query(
      `SELECT COUNT(*)::int as count FROM ai_observations o
       JOIN environmental_events e ON e.id = o.event_id
       WHERE e.report_id = $1`,
      [testReportId]
    );

    expect(obsCountRes2.rows[0].count).toBe(obsCountRes1.rows[0].count);
  });

  // 9. Authorization for Reprocessing Controls
  it('10. should enforce role authorization on report and intelligence reprocessing routes', async () => {
    // 10a. Unauthenticated report reprocess -> 401
    const unauthRes = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/reprocess`,
    });
    expect(unauthRes.statusCode).toBe(401);

    // 10b. Resident report reprocess -> 403 Forbidden
    const resAuthRes = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/reprocess`,
      headers: { authorization: `Bearer ${residentToken}` },
    });
    expect(resAuthRes.statusCode).toBe(403);

    // 10c. Maintainer report reprocess -> 200 Success
    const maintRes = await app.inject({
      method: 'POST',
      url: `/reports/${testReportId}/reprocess`,
      headers: { authorization: `Bearer ${maintainerToken}` },
    });
    expect(maintRes.statusCode).toBe(200);
    expect(maintRes.json().success).toBe(true);

    // 10d. Intelligence event reprocess as Maintainer -> 200 Success
    const eventQuery = await pool.query(
      `SELECT id FROM environmental_events WHERE report_id = $1 LIMIT 1`,
      [testReportId]
    );
    const eventId = eventQuery.rows[0]?.id;

    if (eventId) {
      const intelRes = await app.inject({
        method: 'POST',
        url: `/api/intelligence/events/${eventId}/reprocess`,
        headers: { authorization: `Bearer ${maintainerToken}` },
      });
      expect(intelRes.statusCode).toBe(200);
      expect(intelRes.json().success).toBe(true);
    }
  });
});
