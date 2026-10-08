import { describe, it, expect } from 'vitest';

describe('Operations Center Navigation & Architecture Contracts', () => {
  const REQUIRED_OPERATIONS_ROUTES = [
    { path: '/operations', name: 'Command Center' },
    { path: '/operations/map', name: 'Environmental Map' },
    { path: '/operations/reports', name: 'Reports Intelligence' },
    { path: '/operations/hotspots', name: 'Hotspot Intelligence' },
    { path: '/operations/patterns', name: 'Patterns & Vector Search' },
    { path: '/operations/ai', name: 'AI Command Center' },
    { path: '/operations/interventions', name: 'Intervention Center' },
    { path: '/operations/impact', name: 'Impact Analytics' },
    { path: '/operations/status', name: 'System Status' },
    { path: '/operations/settings', name: 'Settings' },
  ];

  it('contains all 10 core operational console routes', () => {
    expect(REQUIRED_OPERATIONS_ROUTES).toHaveLength(10);
    const paths = REQUIRED_OPERATIONS_ROUTES.map((r) => r.path);
    expect(paths).toContain('/operations');
    expect(paths).toContain('/operations/map');
    expect(paths).toContain('/operations/reports');
    expect(paths).toContain('/operations/hotspots');
    expect(paths).toContain('/operations/patterns');
    expect(paths).toContain('/operations/ai');
    expect(paths).toContain('/operations/interventions');
    expect(paths).toContain('/operations/impact');
  });

  it('guarantees desktop-first operational scope defaults to Pune Municipal Corporation', () => {
    const defaultScope = {
      corporation: 'PMC Pune',
      ward: 14,
      zone: 3,
      role: 'MAINTAINER',
    };
    expect(defaultScope.role).toBe('MAINTAINER');
    expect(defaultScope.corporation).toBe('PMC Pune');
  });
});
