import React from 'react';
import type { ChartSpec } from '@ecopulse/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface ChartRendererProps {
  spec: ChartSpec;
  height?: number;
}

// Restrained, consistent operational palette (emerald and neutral slate tones)
const OPERATIONAL_PALETTE = ['#10b981', '#059669', '#0d9488', '#047857', '#065f46'];

const SEVERITY_COLOR_MAP: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW: '#10b981',
};

const resolveColor = (name: string, index: number) => {
  const upper = String(name).toUpperCase();
  if (SEVERITY_COLOR_MAP[upper]) {
    return SEVERITY_COLOR_MAP[upper];
  }
  return OPERATIONAL_PALETTE[index % OPERATIONAL_PALETTE.length];
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({ spec, height = 260 }) => {
  if (!spec || !spec.series || spec.series.length === 0) {
    return (
      <div className="flex items-center justify-center bg-slate-900/40 border border-slate-800 rounded-lg p-6 text-slate-500 font-mono text-xs">
        No chart series data available.
      </div>
    );
  }

  // Transform ChartSpec series data into Recharts friendly format
  // Recharts expects array of rows where keys are series names
  const primarySeries = spec.series[0];
  const chartData = (primarySeries?.data || []).map((point, index) => {
    const row: Record<string, any> = {
      name: String(point.x),
      [primarySeries.name || 'value']: point.y,
    };

    // Merge other series if multi-series
    for (let s = 1; s < spec.series.length; s++) {
      const otherSeries = spec.series[s];
      const matchingPoint = otherSeries.data[index];
      if (matchingPoint) {
        row[otherSeries.name || `series_${s}`] = matchingPoint.y;
      }
    }

    return row;
  });

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-4 font-sans">
      {spec.title && (
        <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
          <h4 className="text-xs font-semibold text-slate-200 tracking-wide uppercase font-mono">
            {spec.title}
          </h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {spec.type.toUpperCase()}
          </span>
        </div>
      )}

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === 'pie' ? (
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
              />
              <Pie
                data={chartData}
                dataKey={primarySeries.name || 'value'}
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={45}
                paddingAngle={2}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={resolveColor(entry.name, index)} />
                ))}
              </Pie>
            </PieChart>
          ) : spec.type === 'line' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
              />
              {spec.series.map((s, idx) => (
                <Line
                  key={s.name || idx}
                  type="monotone"
                  dataKey={s.name || 'value'}
                  stroke={resolveColor(s.name, idx)}
                  strokeWidth={2}
                  dot={{ r: 3, fill: resolveColor(s.name, idx) }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#f8fafc',
                }}
              />
              {spec.series.map((s, idx) => (
                <Bar
                  key={s.name || idx}
                  dataKey={s.name || 'value'}
                  fill={resolveColor(s.name, idx)}
                  radius={[3, 3, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
