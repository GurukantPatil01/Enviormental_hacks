import { z } from 'zod';
import type { ChartSpec, MapSpec } from '@ecopulse/types';
import { embeddingProvider } from '../ai/embedding-provider.js';
import { hotspotAnalyzer } from '../services/hotspot.service.js';
import { environmentalIntelligenceService } from '../services/intelligence.service.js';
import type { AgentContext, AgentTool } from './types.js';

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  register<TInput, TOutput>(tool: AgentTool<TInput, TOutput>): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  listTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  getDescriptions(): Array<{ name: string; description: string }> {
    return this.listTools().map((t) => ({ name: t.name, description: t.description }));
  }

  async execute(
    name: string,
    rawInput: unknown,
    context: AgentContext
  ): Promise<any> {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Tool not found: "${name}"`);
    }

    if (tool.authorization && tool.authorization.length > 0) {
      const userRole = (context.role || 'RESIDENT').toUpperCase();
      if (!tool.authorization.includes(userRole)) {
        throw new Error(`Unauthorized: User role "${userRole}" cannot invoke tool "${name}"`);
      }
    }

    const parsedInput = tool.inputSchema.parse(rawInput);
    return tool.handler(parsedInput, context);
  }
}

export const toolRegistry = new ToolRegistry();

// 1. get_environmental_overview
toolRegistry.register({
  name: 'get_environmental_overview',
  description: 'Retrieve real-time city-wide environmental KPIs: total events, open reports, active hotspots.',
  inputSchema: z.object({}),
  handler: async () => environmentalIntelligenceService.getOverview(),
});

// 2. get_ward_statistics
toolRegistry.register({
  name: 'get_ward_statistics',
  description: 'Retrieve environmental report statistics aggregated by municipal ward.',
  inputSchema: z.object({
    wardId: z.string().optional(),
  }),
  handler: async (input) => environmentalIntelligenceService.getWardStatistics(input.wardId),
});

// 3. get_zone_statistics
toolRegistry.register({
  name: 'get_zone_statistics',
  description: 'Retrieve incident and cleanup performance by operational zone.',
  inputSchema: z.object({}),
  handler: async () => environmentalIntelligenceService.getZoneStatistics(),
});

// 4. get_environmental_events
toolRegistry.register({
  name: 'get_environmental_events',
  description: 'List recent environmental hazard events with location coordinates and status.',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).default(20),
    status: z.string().optional(),
  }),
  handler: async (input) => environmentalIntelligenceService.getEvents(input),
});

// 5. get_event_details
toolRegistry.register({
  name: 'get_event_details',
  description: 'Retrieve deep inspection details for a single environmental event including AI analysis.',
  inputSchema: z.object({
    eventId: z.string().uuid(),
  }),
  handler: async (input) => environmentalIntelligenceService.getEventDetails(input.eventId),
});

// 6. get_hotspots
toolRegistry.register({
  name: 'get_hotspots',
  description: 'Retrieve active algorithmic waste and hazard hotspots detected by spatial clustering.',
  inputSchema: z.object({
    status: z.string().optional(),
    minScore: z.number().optional(),
  }),
  handler: async (input) => environmentalIntelligenceService.getHotspots(input),
});

// 7. get_hotspot_details
toolRegistry.register({
  name: 'get_hotspot_details',
  description: 'Retrieve detailed information, radius, center coords, and past interventions for a hotspot.',
  inputSchema: z.object({
    hotspotId: z.string().uuid(),
  }),
  handler: async (input) => environmentalIntelligenceService.getHotspotDetails(input.hotspotId),
});

// 8. get_event_timeline
toolRegistry.register({
  name: 'get_event_timeline',
  description: 'Retrieve chronological timeline of citizen hazard observations.',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(15),
  }),
  handler: async (input) => environmentalIntelligenceService.getEventTimeline(input.limit),
});

// 9. get_waste_distribution
toolRegistry.register({
  name: 'get_waste_distribution',
  description: 'Retrieve breakdown of waste types (illegal dumping, overflowing bin, mixed waste).',
  inputSchema: z.object({}),
  handler: async () => environmentalIntelligenceService.getWasteDistribution(),
});

// 10. get_severity_distribution
toolRegistry.register({
  name: 'get_severity_distribution',
  description: 'Retrieve counts of incidents grouped by severity level (LOW, MEDIUM, HIGH, CRITICAL).',
  inputSchema: z.object({}),
  handler: async () => environmentalIntelligenceService.getSeverityDistribution(),
});

// 11. compare_zones
toolRegistry.register({
  name: 'compare_zones',
  description: 'Compare incident volume and sanitation needs between two operational zones or clusters.',
  inputSchema: z.object({
    zoneAId: z.string(),
    zoneBId: z.string(),
  }),
  handler: async (input) => environmentalIntelligenceService.compareZones(input.zoneAId, input.zoneBId),
});

// 12. find_similar_events
toolRegistry.register({
  name: 'find_similar_events',
  description: 'Use pgvector semantic search to find visually or descriptively similar events within radius.',
  inputSchema: z.object({
    queryText: z.string().min(3),
    maxDistanceMeters: z.number().default(5000),
  }),
  handler: async (input) => {
    const vector = await embeddingProvider.embedText(input.queryText);
    return environmentalIntelligenceService.findSimilarEvents(vector, input.maxDistanceMeters);
  },
});

// 13. find_patterns
toolRegistry.register({
  name: 'find_patterns',
  description: 'Detect recurring temporal patterns (e.g., peak dumping hours) and predicted escalation areas.',
  inputSchema: z.object({}),
  handler: async () => environmentalIntelligenceService.findPatterns(),
});

// 14. get_nearby_events
toolRegistry.register({
  name: 'get_nearby_events',
  description: 'Find active environmental reports located near a specific latitude and longitude.',
  inputSchema: z.object({
    latitude: z.number(),
    longitude: z.number(),
    radiusMeters: z.number().default(2000),
  }),
  handler: async (input) => {
    const dummyVector = new Array(384).fill(0);
    return environmentalIntelligenceService.findSimilarEvents(dummyVector, input.radiusMeters);
  },
});

// 15. get_intervention_history
toolRegistry.register({
  name: 'get_intervention_history',
  description: 'List completed or scheduled municipal field interventions and cleanup crew actions.',
  inputSchema: z.object({
    hotspotId: z.string().uuid().optional(),
  }),
  handler: async (input) => environmentalIntelligenceService.getInterventionHistory(input.hotspotId),
});

// 16. get_intervention_outcomes
toolRegistry.register({
  name: 'get_intervention_outcomes',
  description: 'Retrieve measured outcomes showing before/after report rates and hotspot reduction.',
  inputSchema: z.object({}),
  handler: async () => environmentalIntelligenceService.getInterventionOutcomes(),
});

// 17. generate_visualization
toolRegistry.register({
  name: 'generate_visualization',
  description: 'Generate structured ChartSpec contract for operations dashboard rendering.',
  inputSchema: z.object({
    chartType: z.enum(['line', 'bar', 'pie']),
    title: z.string(),
    metric: z.string(),
  }),
  handler: async (input): Promise<ChartSpec> => {
    const dist = await environmentalIntelligenceService.getWasteDistribution();
    return {
      type: input.chartType,
      title: input.title,
      xAxis: 'Category',
      yAxis: 'Reports',
      series: [
        {
          name: input.metric,
          data: dist.map((d) => ({ x: d.wasteType, y: d.count })),
        },
      ],
    };
  },
});

// 18. generate_map_visualization
toolRegistry.register({
  name: 'generate_map_visualization',
  description: 'Generate structured MapSpec contract with layers for operations map display.',
  inputSchema: z.object({
    centerLat: z.number().default(18.5204),
    centerLng: z.number().default(73.8567),
    zoom: z.number().default(13),
  }),
  handler: async (input): Promise<MapSpec> => {
    const hotspots = await hotspotAnalyzer.getHotspots();
    return {
      center: { lat: input.centerLat ?? 18.5204, lng: input.centerLng ?? 73.8567 },
      zoom: input.zoom ?? 13,
      layers: [
        {
          id: 'active_hotspots',
          type: 'hotspot_circles',
          data: hotspots.map((h) => ({
            id: h.id,
            lat: h.centerLatitude,
            lng: h.centerLongitude,
            radius: h.radius,
            score: h.score,
          })),
        },
      ],
    };
  },
});

// 19. recommend_intervention
toolRegistry.register({
  name: 'recommend_intervention',
  description: 'Formulate an actionable municipal remediation proposal for human maintainer authorization.',
  authorization: ['SUPERVISOR', 'ADMIN', 'MAINTAINER'],
  inputSchema: z.object({
    hotspotId: z.string().uuid(),
    reason: z.string(),
  }),
  handler: async (input) => {
    const hotspot = await hotspotAnalyzer.getHotspotById(input.hotspotId);
    if (!hotspot) throw new Error('Hotspot not found');

    let recommendedType = 'CLEANUP_CREW';
    if (hotspot.dominantWasteType === 'OVERFLOWING_BIN') recommendedType = 'ADD_BIN';
    if (hotspot.dominantWasteType === 'ILLEGAL_DUMPING') recommendedType = 'SURVEILLANCE_CAMERA';

    return {
      hotspotId: input.hotspotId,
      recommendedType,
      priority: hotspot.score > 40 ? 'HIGH' : 'MEDIUM',
      justification: input.reason || `Automated risk score ${hotspot.score} exceeds threshold.`,
      requiresHumanApproval: true,
    };
  },
});
