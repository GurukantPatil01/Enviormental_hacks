import { z } from 'zod';

export interface AgentContext {
  userId?: string | null;
  conversationId: string;
  role?: string;
  runId: string;
  signal?: AbortSignal;
}

export interface AgentTool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  authorization?: string[]; // e.g. ['MAINTAINER', 'ADMIN', 'RESIDENT']
  handler: (input: TInput, context: AgentContext) => Promise<TOutput>;
}

export interface AgentToolInvocation {
  toolName: string;
  input: Record<string, unknown>;
}

export interface AgentDecision {
  thought: string;
  toolCall?: AgentToolInvocation | null;
  finalResponse?: string | null;
}

export interface AgentRoundRecord {
  round: number;
  thought: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string | null;
  durationMs: number;
}

export interface AgentExecutionResult {
  runId: string;
  conversationId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  roundCount: number;
  totalDurationMs: number;
  finalResponse: string;
  rounds: AgentRoundRecord[];
}
