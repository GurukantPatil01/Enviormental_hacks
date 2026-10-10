import { pool } from '../db/index.js';
import { haversineDistanceMeters } from '../repositories/vector.repository.js';
import type {
  DumpingRepeatRisk,
  ScoringPriorityLevel,
  ScoringUrgencyTimeframe,
} from '@ecopulse/types';

export interface HotspotHistoryContext {
  nearbyEventCount: number;
  isHotspot: boolean;
  dominantWasteType: string;
  averageSeverity: string;
  repeatRisk: DumpingRepeatRisk;
  activeHotspotId?: string | null;
}

/**
 * ADK Tool: Check Hotspot & Violation History
 * Interrogates spatial environmental events within radius to evaluate repeat dumping pattern.
 */
export async function checkHotspotHistoryTool(
  latitude?: number | null,
  longitude?: number | null,
  radiusMeters: number = 300
): Promise<HotspotHistoryContext> {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return {
      nearbyEventCount: 0,
      isHotspot: false,
      dominantWasteType: 'UNKNOWN',
      averageSeverity: 'LOW',
      repeatRisk: 'LOW',
    };
  }

  try {
    const res = await pool.query(
      `SELECT id, latitude, longitude, severity, event_type, status, timestamp
       FROM environmental_events
       WHERE timestamp >= NOW() - INTERVAL '30 days'`
    );

    const nearbyEvents = res.rows.filter((row) => {
      const dist = haversineDistanceMeters(
        latitude,
        longitude,
        Number(row.latitude),
        Number(row.longitude)
      );
      return dist <= radiusMeters;
    });

    const nearbyEventCount = nearbyEvents.length;
    const isHotspot = nearbyEventCount >= 2;

    let repeatRisk: DumpingRepeatRisk = 'LOW';
    if (nearbyEventCount >= 5) {
      repeatRisk = 'CRITICAL_REPEAT_HOTSPOT';
    } else if (nearbyEventCount >= 3) {
      repeatRisk = 'HIGH';
    } else if (nearbyEventCount >= 1) {
      repeatRisk = 'MEDIUM';
    }

    // Determine dominant category
    const categories: Record<string, number> = {};
    for (const ev of nearbyEvents) {
      const cat = ev.event_type || 'WASTE_HOTSPOT';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    const dominantWasteType =
      Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0] || 'GENERAL';

    return {
      nearbyEventCount,
      isHotspot,
      dominantWasteType,
      averageSeverity: nearbyEventCount > 0 ? 'HIGH' : 'LOW',
      repeatRisk,
    };
  } catch (err) {
    console.warn('[ADKTools] Hotspot history check non-blocking error:', err);
    return {
      nearbyEventCount: 0,
      isHotspot: false,
      dominantWasteType: 'UNKNOWN',
      averageSeverity: 'LOW',
      repeatRisk: 'LOW',
    };
  }
}

export interface CalculatePriorityParams {
  severity: string;
  dumpingLikelihood: number;
  potentialObstruction?: string | null;
  environmentalRiskIndicators?: string[] | null;
  repeatLocationRisk?: DumpingRepeatRisk | null;
}

export interface CalculatedPriorityResult {
  priorityScore: number;
  priorityLevel: ScoringPriorityLevel;
  urgencyTimeframe: ScoringUrgencyTimeframe;
  recommendedPointsReward: number;
  riskFactorBreakdown: {
    severityWeight: number;
    dumpingWeight: number;
    publicSafetyWeight: number;
    environmentalWeight: number;
  };
}

/**
 * ADK Tool: Deterministic Priority & Multi-Factor Scoring Engine
 * Combines visible severity, dumping probability, obstruction hazard, and repeat risk into an auditable score.
 */
export function calculatePriorityScoreTool(
  params: CalculatePriorityParams
): CalculatedPriorityResult {
  const {
    severity,
    dumpingLikelihood,
    potentialObstruction = 'NONE',
    environmentalRiskIndicators = [],
    repeatLocationRisk = 'LOW',
  } = params;

  // 1. Severity weight (max 35)
  const normSev = (severity || 'LOW').toUpperCase();
  let severityWeight = 10;
  if (normSev === 'CRITICAL') severityWeight = 35;
  else if (normSev === 'HIGH') severityWeight = 28;
  else if (normSev === 'MEDIUM') severityWeight = 18;

  // 2. Dumping Likelihood weight (max 25)
  const clampedDumping = Math.max(0, Math.min(1, dumpingLikelihood || 0));
  const dumpingWeight = Math.round(clampedDumping * 25);

  // 3. Public safety / obstruction weight (max 20)
  let publicSafetyWeight = 0;
  const normObstruction = (potentialObstruction || 'NONE').toUpperCase();
  if (
    normObstruction.includes('DRAIN') ||
    normObstruction.includes('STORM') ||
    normObstruction.includes('ROAD')
  ) {
    publicSafetyWeight = 20;
  } else if (normObstruction.includes('SIDEWALK') || normObstruction.includes('MULTIPLE')) {
    publicSafetyWeight = 12;
  }

  // 4. Environmental risk indicators + repeat risk (max 20)
  let environmentalWeight = 0;
  if (environmentalRiskIndicators && environmentalRiskIndicators.length > 0) {
    environmentalWeight += Math.min(12, environmentalRiskIndicators.length * 4);
  }
  if (repeatLocationRisk === 'CRITICAL_REPEAT_HOTSPOT') {
    environmentalWeight += 8;
  } else if (repeatLocationRisk === 'HIGH') {
    environmentalWeight += 5;
  } else if (repeatLocationRisk === 'MEDIUM') {
    environmentalWeight += 2;
  }
  environmentalWeight = Math.min(20, environmentalWeight);

  // Composite Priority Score (0 - 100)
  const priorityScore = Math.min(
    100,
    severityWeight + dumpingWeight + publicSafetyWeight + environmentalWeight
  );

  // Priority Level & Urgency Timeframe
  let priorityLevel: ScoringPriorityLevel = 'LOW';
  let urgencyTimeframe: ScoringUrgencyTimeframe = 'ROUTINE_7D';

  if (priorityScore >= 75 || normSev === 'CRITICAL') {
    priorityLevel = 'CRITICAL';
    urgencyTimeframe = 'IMMEDIATE_4H';
  } else if (priorityScore >= 55 || normSev === 'HIGH') {
    priorityLevel = 'HIGH';
    urgencyTimeframe = 'WITHIN_24H';
  } else if (priorityScore >= 35 || normSev === 'MEDIUM') {
    priorityLevel = 'MEDIUM';
    urgencyTimeframe = 'SCHEDULED_48H';
  }

  // Citizen Points Reward: baseline 20 pts + bonus for reporting critical / verified dumping
  let recommendedPointsReward = 20;
  if (clampedDumping >= 0.7 || priorityLevel === 'CRITICAL') {
    recommendedPointsReward = 35;
  } else if (priorityLevel === 'HIGH') {
    recommendedPointsReward = 25;
  }

  return {
    priorityScore,
    priorityLevel,
    urgencyTimeframe,
    recommendedPointsReward,
    riskFactorBreakdown: {
      severityWeight,
      dumpingWeight,
      publicSafetyWeight,
      environmentalWeight,
    },
  };
}

export interface SafetyGuardrailParams {
  evidenceQuality?: string | null;
  confidence?: number | null;
  limitations?: string | string[] | null;
  dumpingLikelihood?: number | null;
}

/**
 * ADK Tool: Responsible AI Safety & Human Verification Guardrail
 * Enforces Core AI Rules: AI cannot accuse individuals, deduct points, or authorize intervention alone.
 */
export function evaluateSafetyGuardrailsTool(params: SafetyGuardrailParams): {
  requiresHumanReview: boolean;
  guardrailTriggers: string[];
} {
  const triggers: string[] = [];
  const quality = (params.evidenceQuality || 'STANDARD').toUpperCase();
  const confidence = params.confidence ?? 0.8;

  if (quality === 'LOW' || quality === 'BLURRY_UNREADABLE') {
    triggers.push(`Evidence quality marked as ${quality}`);
  }

  if (confidence < 0.70) {
    triggers.push(`Model observation confidence (${Math.round(confidence * 100)}%) is below 70% threshold`);
  }

  if (params.limitations) {
    const limStr = Array.isArray(params.limitations)
      ? params.limitations.join(' ')
      : String(params.limitations);
    if (
      limStr.toLowerCase().includes('dark') ||
      limStr.toLowerCase().includes('blur') ||
      limStr.toLowerCase().includes('occlu') ||
      limStr.toLowerCase().includes('ambiguous')
    ) {
      triggers.push('Observation has visibility or environmental occlusions noted in limitations');
    }
  }

  return {
    requiresHumanReview: triggers.length > 0,
    guardrailTriggers: triggers,
  };
}
