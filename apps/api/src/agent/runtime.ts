import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AgentRun, AgentToolCall } from "@ecopulse/types";
import type { ToolRegistry } from "./tool-registry.js";
import type { AgentReasoningProvider } from "./reasoning-provider.js";
import type { AgentDecision, AgentRoundRecord } from "./types.js";
import { agentRuns, agentToolCalls } from "../db/schema.js";
import type { AppDatabase } from "../db/index.js";

export interface AgentContextInput {
  userId?: string;
  conversationId: string;
  role?: string;
  maxRounds?: number;
  timeoutMs?: number;
}

export interface AgentExecutionResult {
  run: AgentRun;
  steps: AgentToolCall[];
  finalResponse: string;
}

export interface AgentRuntime {
  execute(query: string, context: AgentContextInput): Promise<AgentExecutionResult>;
}

export class LocalAgentRuntime implements AgentRuntime {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly reasoningProvider: AgentReasoningProvider,
    private readonly db?: AppDatabase,
  ) {}

  async execute(query: string, context: AgentContextInput): Promise<AgentExecutionResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const maxRounds = context.maxRounds ?? 6;
    const timeoutMs = context.timeoutMs ?? 30000;
    const startTime = Date.now();

    const toolCallsExecuted: AgentToolCall[] = [];
    const roundHistory: AgentRoundRecord[] = [];

    let round = 1;
    let finalResponse = "";
    let status: AgentRun["status"] = "in_progress";

    // Optional: persist initial run record if DB is available
    if (this.db) {
      try {
        await this.db.insert(agentRuns).values({
          id: runId,
          userId: context.userId ?? "anonymous",
          conversationId: context.conversationId,
          startedAt: new Date(startedAt),
          status: "in_progress",
          roundCount: 0,
        });
      } catch {
        // Log or handle gracefully in offline testing
      }
    }

    try {
      while (round <= maxRounds) {
        if (Date.now() - startTime > timeoutMs) {
          status = "failed";
          finalResponse = `Execution timed out after ${timeoutMs}ms.`;
          break;
        }

        const availableTools = this.toolRegistry.listTools().map((t) => ({
          name: t.name,
          description: t.description,
        }));

        const decision: AgentDecision = await this.reasoningProvider.decideNextStep(
          query,
          roundHistory,
          availableTools,
        );

        if (!decision.toolCall) {
          finalResponse = decision.finalResponse ?? decision.thought ?? "Execution concluded.";
          status = "completed";
          break;
        }

        // Execute tool call
        const toolCallId = randomUUID();
        const toolStartTime = Date.now();
        const toolName = decision.toolCall.toolName;
        const toolInput = decision.toolCall.input;

        let toolOutput: any = null;
        let toolError: string | undefined = undefined;
        let callStatus: AgentToolCall["status"] = "SUCCESS";

        try {
          toolOutput = await this.toolRegistry.execute(toolName, toolInput, {
            runId,
            conversationId: context.conversationId,
            userId: context.userId,
            role: context.role,
          });
        } catch (err) {
          callStatus = "ERROR";
          toolError = err instanceof Error ? err.message : String(err);
          toolOutput = { error: toolError };
        }

        const duration = Date.now() - toolStartTime;

        const recordedToolCall: AgentToolCall = {
          id: toolCallId,
          agentRunId: runId,
          round,
          toolName,
          input: toolInput,
          output: toolOutput,
          status: callStatus,
          duration,
          error: toolError,
          createdAt: new Date().toISOString(),
        };

        toolCallsExecuted.push(recordedToolCall);

        roundHistory.push({
          round,
          thought: decision.thought,
          toolName,
          input: toolInput,
          output: toolOutput,
          error: toolError,
          durationMs: duration,
        });

        // Record in DB if present
        if (this.db) {
          try {
            await this.db.insert(agentToolCalls).values({
              id: toolCallId,
              agentRunId: runId,
              round,
              toolName,
              input: JSON.stringify(toolInput),
              output: JSON.stringify(toolOutput),
              status: callStatus,
              duration,
              error: toolError ?? null,
              createdAt: new Date(),
            });
          } catch {
            // non-fatal in local/mock environments
          }
        }

        round++;
      }

      if (round > maxRounds && !finalResponse) {
        status = "completed";
        finalResponse = `Agent reached maximum round budget (${maxRounds}) without explicit conclusion. Executed ${toolCallsExecuted.length} operations.`;
      }
    } catch (error) {
      status = "failed";
      finalResponse = error instanceof Error ? error.message : "Internal agent execution error";
    }

    const completedAt = new Date().toISOString();
    const totalDuration = Date.now() - startTime;

    const runResult: AgentRun = {
      id: runId,
      conversationId: context.conversationId,
      userId: context.userId ?? "anonymous",
      startedAt,
      completedAt,
      status,
      roundCount: toolCallsExecuted.length,
      totalDuration,
      finalResponse,
    };

    if (this.db) {
      try {
        await this.db
          .update(agentRuns)
          .set({
            completedAt: new Date(completedAt),
            status,
            roundCount: toolCallsExecuted.length,
            totalDuration,
            finalResponse,
          })
          .where(eq(agentRuns.id, runId));
      } catch {
        // non-fatal
      }
    }

    return {
      run: runResult,
      steps: toolCallsExecuted,
      finalResponse,
    };
  }
}
