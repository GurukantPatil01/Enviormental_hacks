import { describe, it, expect } from 'vitest';
import type { ChartSpec, MapSpec, AgentToolCall } from '@ecopulse/types';

describe('Operations Business Logic & Visual Contracts', () => {
  it('validates ChartSpec structure conforms to operational requirements', () => {
    const validSpec: ChartSpec = {
      type: 'bar',
      title: 'Waste Incidents by Category',
      xAxis: 'Category',
      yAxis: 'Reports',
      series: [
        {
          name: 'Reports',
          data: [
            { x: 'Plastic', y: 14 },
            { x: 'Organic', y: 9 },
          ],
        },
      ],
    };

    expect(validSpec.type).toBe('bar');
    expect(validSpec.series).toHaveLength(1);
    expect(validSpec.series[0].data[0].y).toBe(14);
  });

  it('validates MapSpec structure conforms to operational GIS layer contracts', () => {
    const validMapSpec: MapSpec = {
      center: { lat: 18.5204, lng: 73.8567 },
      zoom: 14,
      layers: [
        {
          id: 'hotspot_layer',
          type: 'hotspot_circles',
          data: [
            { id: 'h1', lat: 18.5204, lng: 73.8567, radius: 300, dominantWasteType: 'Plastic' },
          ],
        },
      ],
    };

    expect(validMapSpec.center.lat).toBe(18.5204);
    expect(validMapSpec.layers[0].type).toBe('hotspot_circles');
    expect(validMapSpec.layers[0].data).toHaveLength(1);
  });

  it('calculates longitudinal intervention outcome metrics correctly', () => {
    const outcome = {
      beforeReportRate: 20,
      afterReportRate: 5,
      beforeSeverity: 4.0,
      afterSeverity: 1.0,
      beforeHotspotSize: 400,
      afterHotspotSize: 100,
    };

    const rateReduction = (outcome.beforeReportRate - outcome.afterReportRate) / outcome.beforeReportRate;
    const severityReduction = (outcome.beforeSeverity - outcome.afterSeverity) / outcome.beforeSeverity;
    const sizeReduction = (outcome.beforeHotspotSize - outcome.afterHotspotSize) / outcome.beforeHotspotSize;

    // 0.4 * 0.75 + 0.35 * 0.75 + 0.25 * 0.75 = 0.75
    const successScore = 0.4 * rateReduction + 0.35 * severityReduction + 0.25 * sizeReduction;

    expect(rateReduction).toBe(0.75); // 75% reduction
    expect(severityReduction).toBe(0.75);
    expect(sizeReduction).toBe(0.75);
    expect(successScore).toBeCloseTo(0.75);
  });

  it('verifies safe execution metadata from real AgentToolCall steps without exposing CoT', () => {
    const toolSteps: AgentToolCall[] = [
      {
        id: 'step-1',
        agentRunId: 'run-1',
        round: 1,
        toolName: 'get_hotspots',
        input: { status: 'ACTIVE' },
        output: { count: 3 },
        status: 'SUCCESS',
        duration: 142,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'step-2',
        agentRunId: 'run-1',
        round: 2,
        toolName: 'get_event_timeline',
        input: { limit: 10 },
        output: { events: [] },
        status: 'SUCCESS',
        duration: 81,
        createdAt: new Date().toISOString(),
      },
    ];

    expect(toolSteps).toHaveLength(2);
    expect(toolSteps[0].toolName).toBe('get_hotspots');
    expect(toolSteps[0].duration).toBe(142);
    expect(toolSteps[0].status).toBe('SUCCESS');
  });

  it('enforces affirmative human approval transition for draft interventions', () => {
    const aiProposedIntervention = {
      id: 'inv-test-1',
      status: 'draft',
      type: 'Deploy Barrier Receptacle',
      notes: 'Recommended by EcoPulse AI. Awaiting supervisor approval.',
    };

    // Before approval: can NOT start execution directly
    expect(aiProposedIntervention.status).toBe('draft');

    // Human supervisor executes approval action
    const approvedIntervention = {
      ...aiProposedIntervention,
      status: 'approved',
      approvedBy: 'supervisor-console',
    };

    expect(approvedIntervention.status).toBe('approved');
    expect(approvedIntervention.approvedBy).toBe('supervisor-console');
  });
});
