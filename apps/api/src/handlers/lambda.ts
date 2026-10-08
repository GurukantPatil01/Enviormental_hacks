import { ecoPulseEventSchema } from "@ecopulse/validation";
import type { EcoPulseEvent } from "@ecopulse/types";
import type { EnvironmentalPipelineService } from "../services/pipeline.service.js";

export interface LambdaEventBridgePayload {
  version: string;
  id: string;
  "detail-type": string;
  source: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
  detail: unknown;
}

export interface LambdaResult {
  statusCode: number;
  body: string;
}

/**
 * Helper to extract and validate an EcoPulseEvent from either a direct invocation or EventBridge envelope.
 */
export function parseAndValidateEvent(rawEvent: unknown): EcoPulseEvent {
  let eventData = rawEvent;

  // If invoked via EventBridge event wrapper
  if (rawEvent && typeof rawEvent === "object" && "detail" in rawEvent) {
    const eb = rawEvent as LambdaEventBridgePayload;
    eventData = eb.detail;
  }

  const parsed = ecoPulseEventSchema.safeParse(eventData);
  if (!parsed.success) {
    throw new Error(`Invalid EcoPulse event format: ${parsed.error.message}`);
  }

  return parsed.data as EcoPulseEvent;
}

/**
 * Lambda Handler: reportProcessor
 * Thin adapter: parse -> validate -> delegate to pipeline service
 */
export async function createReportProcessorHandler(
  pipelineService: EnvironmentalPipelineService,
): Promise<(event: unknown) => Promise<LambdaResult>> {
  return async (event: unknown) => {
    try {
      const validEvent = parseAndValidateEvent(event);
      await pipelineService.processReport(validEvent);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Report processed successfully", eventId: validEvent.eventId }),
      };
    } catch (error) {
      console.error("[reportProcessor] Execution failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error instanceof Error ? error.message : "Processing error" }),
      };
    }
  };
}

/**
 * Lambda Handler: aiAnalysisProcessor
 */
export async function createAIAnalysisProcessorHandler(
  pipelineService: EnvironmentalPipelineService,
): Promise<(event: unknown) => Promise<LambdaResult>> {
  return async (event: unknown) => {
    try {
      const validEvent = parseAndValidateEvent(event);
      await pipelineService.processAIAnalysis(validEvent);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "AI analysis processed successfully", eventId: validEvent.eventId }),
      };
    } catch (error) {
      console.error("[aiAnalysisProcessor] Execution failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error instanceof Error ? error.message : "Processing error" }),
      };
    }
  };
}

/**
 * Lambda Handler: embeddingProcessor
 */
export async function createEmbeddingProcessorHandler(
  pipelineService: EnvironmentalPipelineService,
): Promise<(event: unknown) => Promise<LambdaResult>> {
  return async (event: unknown) => {
    try {
      const validEvent = parseAndValidateEvent(event);
      await pipelineService.processEmbedding(validEvent);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Embedding processed successfully", eventId: validEvent.eventId }),
      };
    } catch (error) {
      console.error("[embeddingProcessor] Execution failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error instanceof Error ? error.message : "Processing error" }),
      };
    }
  };
}

/**
 * Lambda Handler: hotspotProcessor
 */
export async function createHotspotProcessorHandler(
  pipelineService: EnvironmentalPipelineService,
): Promise<(event: unknown) => Promise<LambdaResult>> {
  return async (event: unknown) => {
    try {
      const validEvent = parseAndValidateEvent(event);
      await pipelineService.processHotspotAnalysis(validEvent);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Hotspot analysis completed", eventId: validEvent.eventId }),
      };
    } catch (error) {
      console.error("[hotspotProcessor] Execution failed:", error);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error instanceof Error ? error.message : "Processing error" }),
      };
    }
  };
}
