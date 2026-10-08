import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Sparkles,
  MapPin,
  Clock,
  Sliders,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { useVectorSearch } from '../hooks/useVectorSearch';
import { usePatternSearch } from '../hooks/useIntelligence';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatRelativeTime } from '../lib/formatters';

export const PatternSearch: React.FC = () => {
  const navigate = useNavigate();

  const [queryText, setQueryText] = useState('Plastic packaging and commercial dumping near water channel');
  const [radiusKm, setRadiusKm] = useState(10);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5);

  const { mutate: executeSearch, data: searchResults, isPending } = useVectorSearch();
  const { data: discoveredPatterns, isLoading: patternsLoading } = usePatternSearch();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryText.trim()) return;

    executeSearch({
      text: queryText.trim(),
      latitude: 18.5204, // Pune center
      longitude: 73.8567,
      radiusKm,
      limit: 12,
    });
  };

  // Filter results by similarity threshold if available
  const filteredResults = (searchResults || []).filter(
    (res) => (res.similarity ?? 0) >= similarityThreshold
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Environmental Pattern & Vector Search
          </h1>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            PGVECTOR SEMANTIC INDEX
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Perform high-dimensional cosine similarity searches across environmental incidents, recurring dumping signatures, and temporal patterns.
        </p>
      </div>

      {/* Query Bar & Controls */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="E.g., Recurring plastic bag dumping near bridge, untreated chemical smell..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm flex items-center space-x-1.5 transition-colors shrink-0 disabled:opacity-50"
          >
            {isPending ? 'Searching...' : 'Search Vectors'}
          </button>
        </form>

        {/* Sliders for radius & threshold */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60 font-mono text-xs">
          <div className="flex items-center space-x-3">
            <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 text-[11px] shrink-0">Geographic Radius:</span>
            <input
              type="range"
              min="1"
              max="25"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="flex-1 accent-emerald-500 h-1 bg-slate-800 rounded"
            />
            <span className="text-emerald-400 font-bold text-xs shrink-0 w-12 text-right">
              {radiusKm} km
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-400 text-[11px] shrink-0">Min Similarity:</span>
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
              className="flex-1 accent-emerald-500 h-1 bg-slate-800 rounded"
            />
            <span className="text-emerald-400 font-bold text-xs shrink-0 w-12 text-right">
              {(similarityThreshold * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Discovered Recurring Patterns Strip */}
      {discoveredPatterns && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              Discovered Temporal & Spatial Patterns
            </span>
            <span className="text-[10px] text-slate-400">
              {discoveredPatterns.recurringHotspotsCount || 0} RECURRING PATTERNS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(discoveredPatterns.temporalPatterns || []).map((p: any, idx: number) => (
              <div
                key={idx}
                className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg flex items-start space-x-3"
              >
                <div className="p-2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 font-mono text-[10px]">
                  {p.frequency}
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-semibold text-slate-200 font-mono">{p.timeWindow}</div>
                  <p className="text-slate-400 text-[11px] mt-0.5">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vector Results Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
          <span>Vector Similarity Matches ({filteredResults.length})</span>
          {searchResults && (
            <span className="text-[10px] text-slate-400">
              INDEX: COSINE DISTANCE OVER 768-D EMBEDDINGS
            </span>
          )}
        </div>

        {!searchResults && !isPending ? (
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-lg">
            <EmptyState
              title="Execute a vector search query"
              description="Type an environmental scenario or keyword pattern above to retrieve semantically related incident events."
            />
          </div>
        ) : isPending ? (
          <div className="p-12 text-center text-xs font-mono text-slate-400">
            Calculating vector cosine distance across incident embeddings...
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="p-8 bg-slate-950 border border-slate-800 rounded-lg">
            <EmptyState
              title="No events meet the similarity threshold"
              description="Try lowering the minimum similarity percentage slider or broadening the search radius."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResults.map((item, index) => {
              const simPercent = Math.round((item.similarity || 0) * 100);
              const event = item.event;

              return (
                <div
                  key={item.eventId || index}
                  className="p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg transition-all flex flex-col justify-between space-y-3 font-sans"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {simPercent}% Match
                      </span>
                      {event?.status && <StatusBadge status={event.status} />}
                    </div>

                    <h4 className="text-xs font-semibold text-slate-100 line-clamp-2">
                      {event?.description || 'Environmental Incident Record'}
                    </h4>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 font-mono text-[10px] text-slate-400 space-y-1">
                    {event?.latitude && event?.longitude && (
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>
                          {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                        </span>
                      </div>
                    )}
                    {event?.timestamp && (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatRelativeTime(event.timestamp)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
