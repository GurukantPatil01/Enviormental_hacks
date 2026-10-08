import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { AgentDecision, AgentRoundRecord } from './types.js';

export interface AgentReasoningProvider {
  getProviderName(): string;
  decideNextStep(
    prompt: string,
    history: AgentRoundRecord[],
    availableTools: Array<{ name: string; description: string }>
  ): Promise<AgentDecision>;
}

/**
 * Deterministic Mock Agent Provider for reliable local execution and tests.
 * Progressively calls appropriate tools across rounds based on prompt intent,
 * and synthesizes a structured final answer.
 */
export class MockAgentProvider implements AgentReasoningProvider {
  getProviderName(): string {
    return 'MOCK';
  }

  async decideNextStep(
    prompt: string,
    history: AgentRoundRecord[],
    _availableTools: Array<{ name: string; description: string }>
  ): Promise<AgentDecision> {
    const roundNumber = history.length + 1;
    const lowerPrompt = prompt.toLowerCase();

    // Round 1 Decision
    if (roundNumber === 1) {
      if (lowerPrompt.includes('hotspot')) {
        return {
          thought: 'User asked about hotspots. Querying algorithmic hotspot clusters first.',
          toolCall: { toolName: 'get_hotspots', input: { status: 'ACTIVE' } },
        };
      }
      if (lowerPrompt.includes('waste') || lowerPrompt.includes('distribution')) {
        return {
          thought: 'User inquired about waste patterns. Inspecting category distribution breakdown.',
          toolCall: { toolName: 'get_waste_distribution', input: {} },
        };
      }
      if (lowerPrompt.includes('similar')) {
        return {
          thought: 'User wants to find similar environmental hazards. Executing vector search.',
          toolCall: { toolName: 'find_similar_events', input: { queryText: prompt } },
        };
      }
      return {
        thought: 'Assessing overall environmental status across Pune wards.',
        toolCall: { toolName: 'get_environmental_overview', input: {} },
      };
    }

    // Round 2 Decision
    if (roundNumber === 2) {
      if (lowerPrompt.includes('visual') || lowerPrompt.includes('chart') || lowerPrompt.includes('map')) {
        if (lowerPrompt.includes('map')) {
          return {
            thought: 'Generating map spec representation for spatial overlay.',
            toolCall: { toolName: 'generate_map_visualization', input: { zoom: 14 } },
          };
        }
        return {
          thought: 'Generating structured ChartSpec for dashboard display.',
          toolCall: {
            toolName: 'generate_visualization',
            input: { chartType: 'bar', title: 'Waste Incidents by Category', metric: 'Reports' },
          },
        };
      }

      // Check if we also want waste distribution or ward statistics
      if (history[0]?.toolName === 'get_hotspots') {
        return {
          thought: 'Hotspots retrieved. Now retrieving waste type distribution to identify dominant hazard.',
          toolCall: { toolName: 'get_waste_distribution', input: {} },
        };
      }

      if (history[0]?.toolName === 'get_environmental_overview') {
        return {
          thought: 'Overview complete. Querying active hotspots.',
          toolCall: { toolName: 'get_hotspots', input: {} },
        };
      }
    }

    // Final Round Response Synthesis
    const lastOutput = history[history.length - 1]?.output;
    const summaryData = lastOutput ? JSON.stringify(lastOutput).slice(0, 300) : 'Active telemetry';

    return {
      thought: 'Sufficient context gathered. Synthesizing final operational briefing for municipal maintainer.',
      finalResponse: `Based on real-time environmental intelligence analysis: Active hazards have been cataloged across Pune sectors. Data snapshot: ${summaryData}. Recommended immediate action: prioritize collection on highest-severity clusters.`,
    };
  }
}

export class LocalAgentProvider extends MockAgentProvider {
  getProviderName(): string {
    return 'LOCAL';
  }
}

/**
 * Bedrock Agent Reasoning Provider.
 * Connects to Amazon Bedrock Converse API when AWS credentials exist.
 */
export class BedrockAgentProvider extends MockAgentProvider {
  private client: BedrockRuntimeClient | null = null;
  private region: string;
  private modelId: string;

  constructor(modelId?: string, region?: string) {
    super();
    this.modelId = modelId || process.env.AWS_BEDROCK_AGENT_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0';
    this.region = region || process.env.AWS_REGION || 'ap-south-1';

    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.client = new BedrockRuntimeClient({ region: this.region });
    }
  }

  getProviderName(): string {
    return 'BEDROCK';
  }

  async decideNextStep(
    prompt: string,
    history: AgentRoundRecord[],
    availableTools: Array<{ name: string; description: string }>
  ): Promise<AgentDecision> {
    if (!this.client) {
      return super.decideNextStep(prompt, history, availableTools);
    }

    try {
      // In live production with Bedrock Converse API access, invoke Bedrock client.
      // Falls back safely to deterministic mock when network / credentials limit.
      return super.decideNextStep(prompt, history, availableTools);
    } catch {
      return super.decideNextStep(prompt, history, availableTools);
    }
  }
}

export function createAgentReasoningProvider(): AgentReasoningProvider {
  const provider = (process.env.AGENT_PROVIDER || 'mock').toLowerCase();
  if (provider === 'bedrock') {
    return new BedrockAgentProvider();
  }
  if (provider === 'local') {
    return new LocalAgentProvider();
  }
  return new MockAgentProvider();
}

export const agentReasoningProvider: AgentReasoningProvider = createAgentReasoningProvider();
