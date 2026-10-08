# EcoPulse Operations Center — Architectural & Application Structure

## 1. Overview & Strategy

The **EcoPulse Environmental Operations Center** is a dedicated, desktop-first command and intelligence application created for municipal environmental officers, field supervisors, and analytical teams. 

It runs alongside the backend API and the citizen mobile app in the monorepo, maintaining clean boundaries:
- **Mobile (`apps/mobile`):** Citizen reporting, community incentives, streak rewards, and mobile maintainer tasks (preserved 100% untouched).
- **Backend API (`apps/api`):** Fastify server exposing domain intelligence, pgvector search, hotspot detection, multi-round agent loop, and intervention workflows.
- **Operations Center (`apps/web`):** New desktop-first web application engineered from scratch.

---

## 2. Technical Stack Selection

| Component | Technology | Rationale |
|---|---|---|
| **Framework** | **React + TypeScript + Vite** | Ultra-responsive desktop console with sub-second hot reload, zero SSR hydration hurdles for interactive map viewports, and clean monorepo bundling. |
| **Styling** | **Tailwind CSS + `@ecopulse/design-system`** | Tight operational design tokens (slate/emerald palette, compact spacing, clean borders, non-decorative badges). |
| **Iconography** | **Lucide React** | Crisp, data-dense technical icons suitable for mission-critical operations consoles. |
| **Mapping Engine** | **Leaflet + OpenStreetMap** | Lightweight, high-performance web GIS with zero mandatory API keys, full offline/local support, polygon/radius support for hotspots, and marker clustering. |
| **Data Visualization** | **Recharts + Native SVG** | Direct execution of backend `ChartSpec` contracts (line, bar, pie, time-series) without arbitrary HTML/JS injection. |
| **State & API** | **TanStack Query v5 + `@ecopulse/api-client`** | Declarative caching, background polling, and structured loading/empty/error states. |

---

## 3. Route & Screen Architecture

```
/operations                --> Command Center (Primary Operations Dashboard)
/operations/map            --> Environmental Map (Full-Viewport Interactive Web GIS)
/operations/reports        --> Reports Intelligence (Dense Filterable Event Log & Detail Inspector)
/operations/hotspots       --> Hotspot Intelligence (Two-Panel Cluster Ranker & Temporal Trends)
/operations/patterns       --> Pattern / Vector Search (Semantic & Georadius Hazard Discovery)
/operations/ai             --> AI Command Center (Multi-Round Natural Language Investigation Console)
/operations/interventions  --> Intervention Center (Human Supervisor Approval & Dispatch Workflow)
/operations/impact         --> Impact / Outcome Analytics (Before-and-After Remediation Verification)
/operations/status         --> System Status & Subsystem Health Telemetry
```

---

## 4. Component Hierarchy

```
apps/web/src/
├── app/
│   ├── App.tsx                     # Router configuration & query client provider
│   └── routes.tsx                  # Operation route definitions
├── components/
│   ├── shell/
│   │   ├── OperationsShell.tsx     # Persistent layout container
│   │   ├── Sidebar.tsx             # Left operational navigation & status widget
│   │   └── TopBar.tsx              # Scope selector, quick search, system alerts
│   ├── map/
│   │   ├── EnvironmentalMap.tsx    # Leaflet-based operations map surface
│   │   ├── MapRenderer.tsx         # Backend MapSpec executor
│   │   └── LayerControl.tsx        # Toggle reports, hotspots, severity, boundaries
│   ├── charts/
│   │   ├── ChartRenderer.tsx       # Backend ChartSpec executor
│   │   └── MiniSparkline.tsx       # Inline trend visualizers
│   ├── agent/
│   │   ├── AIWorkspace.tsx         # Natural-language investigation console
│   │   ├── AgentExecutionPanel.tsx # Live display of rounds, tools, latencies, statuses
│   │   └── SafeContentRenderer.tsx # Text + charts + maps renderer for agent outputs
│   ├── interventions/
│   │   ├── InterventionList.tsx    # Categorized remediation cards
│   │   ├── ApprovalModal.tsx       # Human authorization gate with audit notes
│   │   └── OutcomeCard.tsx         # Before vs. after comparative metric visualizer
│   └── common/
│       ├── StatusBadge.tsx         # Unified status indicators
│       ├── SeverityBadge.tsx       # Low / Medium / High / Critical badges
│       ├── MetricStrip.tsx         # Dense KPI summary strips
│       ├── EmptyState.tsx          # Non-broken, intentional empty states
│       └── ErrorState.tsx          # Graceful error boundaries
├── hooks/
│   ├── useIntelligence.ts          # Hooks for overview, distribution, timeline
│   ├── useHotspots.ts              # Hooks for hotspot listings and details
│   ├── useReports.ts               # Hooks for environmental event queries
│   ├── useVectorSearch.ts          # Hooks for semantic pattern retrieval
│   ├── useAgentQuery.ts            # Hooks for multi-round agent investigations
│   └── useInterventions.ts         # Hooks for intervention lifecycle & approval
└── lib/
    ├── api.ts                      # Configured API client communicating with Fastify
    └── formatters.ts               # Date, coordinates, volume, and percentage helpers
```

---

## 5. Phased Implementation Roadmap

- **Phase 1:** Setup `apps/web`, build `OperationsShell`, navigation sidebar, top bar, and theme tokens.
- **Phase 2:** Build Command Center (`/operations`) with live backend KPIs, map overview, critical event feed, and distributions.
- **Phase 3:** Build Environmental Map (`/operations/map`) with multi-layer controls, clustering, and click-to-inspect.
- **Phase 4:** Build Reports Intelligence (`/operations/reports`) with dense filtering and report intelligence panel.
- **Phase 5:** Build Hotspot Intelligence (`/operations/hotspots`) with split-panel layout, risk scores, and trend graphs.
- **Phase 6:** Build Pattern / Vector Search (`/operations/patterns`) with text and image-based semantic retrieval.
- **Phase 7:** Build AI Command Center (`/operations/ai`) with transparent multi-round tool execution steps.
- **Phase 8:** Build AI Response Visualizations (`ChartRenderer`, `MapRenderer` executing backend specs).
- **Phase 9:** Build Intervention Center (`/operations/interventions`) with supervisor approval and status lifecycle.
- **Phase 10:** Build Impact / Outcomes (`/operations/impact`) with before-and-after verification curves.
- **Phase 11:** Implement Demo Seed Script (`scripts/seed/environmental-demo.ts`) to populate rich realistic test data.
- **Phase 12:** Frontend tests, typecheck verification, and end-to-end integration check.
