import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentRuns, agentToolCalls } from "../db/schema.js";
import { toolRegistry } from "../agent/tool-registry.js";
import { MockAgentProvider } from "../agent/reasoning-provider.js";
import { LocalAgentRuntime } from "../agent/runtime.js";

export const agentRoutes: FastifyPluginAsync = async (app) => {

  const reasoningProvider = new MockAgentProvider();
  const agentRuntime = new LocalAgentRuntime(toolRegistry, reasoningProvider, db);

  app.post("/api/agent/query", async (req, reply) => {
    const body = req.body as {
      query: string;
      conversationId?: string;
      userId?: string;
      maxRounds?: number;
    };

    if (!body?.query) {
      return reply.status(400).send({ success: false, error: "Field 'query' is required." });
    }

    const conversationId = body.conversationId ?? randomUUID();
    const result = await agentRuntime.execute(body.query, {
      conversationId,
      userId: body.userId ?? "anonymous",
      maxRounds: body.maxRounds ?? 6,
    });

    return reply.send({
      success: true,
      data: {
        runId: result.run.id,
        conversationId: result.run.conversationId,
        finalResponse: result.finalResponse,
        roundsExecuted: result.steps.length,
        status: result.run.status,
        durationMs: result.run.totalDuration,
        steps: result.steps,
      },
    });
  });

  app.get("/api/agent/runs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.id, id)).limit(1);
    if (!run) {
      return reply.status(404).send({ success: false, error: "Agent run not found." });
    }

    const toolCalls = await db.select().from(agentToolCalls).where(eq(agentToolCalls.agentRunId, id));

    return reply.send({
      success: true,
      data: {
        run: {
          id: run.id,
          conversationId: run.conversationId,
          userId: run.userId,
          startedAt: run.startedAt.toISOString(),
          completedAt: run.completedAt?.toISOString(),
          status: run.status,
          roundCount: run.roundCount,
          totalDuration: run.totalDuration,
          finalResponse: run.finalResponse,
        },
        steps: toolCalls.map((tc: any) => ({
          id: tc.id,
          round: tc.round,
          toolName: tc.toolName,
          input: JSON.parse(tc.input),
          output: tc.output ? JSON.parse(tc.output) : null,
          status: tc.status,
          duration: tc.duration,
          error: tc.error ?? undefined,
          createdAt: tc.createdAt.toISOString(),
        })),
      },
    });
  });
};
