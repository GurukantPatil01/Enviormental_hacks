import { GoogleGenAI } from '@google/genai';
import type { DumpingAnalysis, VisionObservation } from '@ecopulse/types';
import { dumpingAnalysisSchema } from '@ecopulse/validation';
import { agentRunRepository } from '../repositories/agent-run.repository.js';
import { checkHotspotHistoryTool } from './adk-tools.js';

export interface DumpingAnalysisInput {
  evidenceId: string;
  reportId?: string | null;
  observation: VisionObservation;
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string | null;
}

export class DumpingAnalysisAgent {
  private client: GoogleGenAI | null = null;
  private apiKey: string;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    if (this.apiKey) {
      this.client = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  async analyze(input: DumpingAnalysisInput): Promise<DumpingAnalysis> {
    const { observation, latitude, longitude, locationAddress, evidenceId } = input;

    // 1. Tool Call: Query spatial hotspot history
    const hotspotContext = await checkHotspotHistoryTool(latitude, longitude);

    // 2. Execute with Google GenAI if credentials exist, else fallback to deterministic ADK logic
    let result: DumpingAnalysis;
    if (this.client && process.env.AI_ENABLED !== 'false') {
      try {
        result = await this.executeGeminiADK(input, hotspotContext);
      } catch (err: any) {
        console.warn(`[DumpingAnalysisAgent] Gemini ADK execution failed (${err.message}), using deterministic fallback.`);
        result = this.executeDeterministicADK(input, hotspotContext);
      }
    } else {
      result = this.executeDeterministicADK(input, hotspotContext);
    }

    // 3. Persist Agent Run Record
    try {
      await agentRunRepository.create({
        agentType: 'DUMPING_ANALYSIS',
        entityType: 'EVIDENCE',
        entityId: evidenceId,
        provider: this.client ? 'GEMINI' : 'DETERMINISTIC_ADK',
        model: this.modelName,
        status: 'COMPLETED',
        inputReference: evidenceId,
        outputReference: result as any,
        metadata: {
          hotspotContext,
          locationAddress,
        },
      });
    } catch (runErr) {
      console.warn('[DumpingAnalysisAgent] Non-blocking error persisting agent run:', runErr);
    }

    return result;
  }

  private async executeGeminiADK(
    input: DumpingAnalysisInput,
    hotspotContext: any
  ): Promise<DumpingAnalysis> {
    const { observation, locationAddress } = input;
    const geminiMeta = (observation as any).geminiAnalysis;

    const systemInstruction = `
You are the EcoPulse Municipal Dumping Analysis Specialist Agent.
Your job is to objectively analyze waste evidence reports, evaluate illegal dumping likelihood, classify dumping patterns, and recommend deterrence strategies for Indian municipal wards.

CRITICAL RESPONSIBLE AI PRINCIPLES:
1. Base observations strictly on evidence. Never fabricate individual names, vehicle registrations, or accusations.
2. Distinguish routine collection overflows from deliberate illegal dumping or commercial fly-tipping.
3. Factor in nearby hotspot history: ${hotspotContext.nearbyEventCount} incidents recorded nearby in the past 30 days (Repeat Risk: ${hotspotContext.repeatRisk}).
4. Return strictly valid JSON adhering to the specified schema.
`;

    const userPrompt = `
Analyze the following environmental incident:
- Category Hint: ${observation.category}
- Visible Severity: ${observation.severity}
- Confidence: ${observation.confidence}
- Visual Findings: ${observation.observations}
- Detected Objects: ${observation.detectedObjects?.join(', ') || 'None'}
- Approximate Extent: ${geminiMeta?.approximateExtent || 'Unknown'}
- Potential Obstruction: ${geminiMeta?.potentialObstruction || 'None'}
- Environmental Risk Indicators: ${geminiMeta?.environmentalRiskIndicators?.join(', ') || 'None'}
- Location Context: ${locationAddress || 'Urban Ward'}
- Nearby Incidents: ${hotspotContext.nearbyEventCount} (Repeat Risk: ${hotspotContext.repeatRisk})

Generate a structured dumping assessment JSON with:
{
  "dumpingLikelihood": number (0.0 to 1.0),
  "dumpingClassification": "COMMERCIAL_FLYWASHDOWN" | "RESIDENTIAL_BULK" | "CONSTRUCTION_DEMOLITION" | "ROUTINE_BIN_OVERFLOW" | "HAZARDOUS_CHEMICAL" | "LITTERING" | "UNKNOWN_OTHER",
  "repeatLocationRisk": "${hotspotContext.repeatRisk}",
  "drainageRunoffRisk": boolean,
  "estimatedVolumeCategory": "SMALL_BAG" | "MEDIUM_PILE" | "LARGE_VEHICULAR_LOAD" | "MASSIVE_ACCUMULATION",
  "recommendedIntervention": "DISPATCH_FIELD_CREW" | "INSTALL_SURVEILLANCE" | "DRAIN_CLEARANCE" | "ENFORCEMENT_INVESTIGATION" | "COMMUNITY_DRIVE" | "REGULAR_COLLECTION_ADJUSTMENT",
  "deterrenceStrategy": string,
  "reasoning": string,
  "detectedKeyItems": string[]
}
`;

    const response = await this.client!.models.generateContent({
      model: this.modelName,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    const cleanJson = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);
    return dumpingAnalysisSchema.parse(parsed);
  }

  private executeDeterministicADK(
    input: DumpingAnalysisInput,
    hotspotContext: any
  ): DumpingAnalysis {
    const { observation } = input;
    const cat = observation.category || 'WASTE_HOTSPOT';
    const sev = observation.severity || 'MEDIUM';
    const geminiMeta = (observation as any).geminiAnalysis;

    let dumpingLikelihood = 0.35;
    let dumpingClassification: DumpingAnalysis['dumpingClassification'] = 'LITTERING';
    let volumeCategory: DumpingAnalysis['estimatedVolumeCategory'] = 'MEDIUM_PILE';
    let recommendedIntervention: DumpingAnalysis['recommendedIntervention'] = 'DISPATCH_FIELD_CREW';
    let deterrence = 'Schedule routine ward sanitation round.';

    const catStr = String(cat);
    if (catStr === 'ILLEGAL_DUMPING' || catStr === 'CONSTRUCTION_DEBRIS') {
      dumpingLikelihood = 0.88;
      dumpingClassification =
        catStr === 'CONSTRUCTION_DEBRIS' ? 'CONSTRUCTION_DEMOLITION' : 'RESIDENTIAL_BULK';
      volumeCategory = 'LARGE_VEHICULAR_LOAD';
      recommendedIntervention =
        hotspotContext.repeatRisk === 'CRITICAL_REPEAT_HOTSPOT' || hotspotContext.repeatRisk === 'HIGH'
          ? 'INSTALL_SURVEILLANCE'
          : 'ENFORCEMENT_INVESTIGATION';
      deterrence =
        'Install deterrent signage and propose solar-powered CCTV surveillance unit at this recurring dumping point.';
    } else if (cat === 'OVERFLOWING_BIN' || cat === 'MISSED_COLLECTION') {
      dumpingLikelihood = 0.25;
      dumpingClassification = 'ROUTINE_BIN_OVERFLOW';
      volumeCategory = 'MEDIUM_PILE';
      recommendedIntervention = 'REGULAR_COLLECTION_ADJUSTMENT';
      deterrence = 'Increase bin collection frequency and calibrate route schedule with ward supervisor.';
    } else if (sev === 'CRITICAL') {
      dumpingLikelihood = 0.85;
      dumpingClassification = 'COMMERCIAL_FLYWASHDOWN';
      volumeCategory = 'MASSIVE_ACCUMULATION';
      recommendedIntervention = 'DISPATCH_FIELD_CREW';
      deterrence = 'Deploy high-capacity municipal loader and prioritize immediate perimeter clearance.';
    }

    const normObs = (geminiMeta?.potentialObstruction || '').toUpperCase();
    const drainageRunoffRisk =
      normObs.includes('DRAIN') ||
      normObs.includes('STORM') ||
      (geminiMeta?.environmentalRiskIndicators || []).some((r: string) =>
        r.toLowerCase().includes('water') || r.toLowerCase().includes('drain')
      );

    if (drainageRunoffRisk && (recommendedIntervention === 'DISPATCH_FIELD_CREW' || recommendedIntervention === 'REGULAR_COLLECTION_ADJUSTMENT')) {
      recommendedIntervention = 'DRAIN_CLEARANCE';
    }

    return {
      dumpingLikelihood,
      dumpingClassification,
      repeatLocationRisk: hotspotContext.repeatRisk,
      drainageRunoffRisk,
      estimatedVolumeCategory: volumeCategory,
      recommendedIntervention,
      deterrenceStrategy: deterrence,
      reasoning: `Dumping likelihood estimated at ${Math.round(dumpingLikelihood * 100)}% based on ${cat.replace(/_/g, ' ')} evidence with ${hotspotContext.repeatRisk.toLowerCase()} repeat site risk.`,
      detectedKeyItems: observation.detectedObjects || [],
    };
  }
}

export const dumpingAnalysisAgent = new DumpingAnalysisAgent();
