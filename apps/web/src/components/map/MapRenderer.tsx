import React from 'react';
import type { MapSpec } from '@ecopulse/types';
import { EnvironmentalMap, MapMarkerItem } from './EnvironmentalMap';

interface MapRendererProps {
  spec: MapSpec;
  height?: string;
  onMarkerClick?: (marker: MapMarkerItem) => void;
}

export const MapRenderer: React.FC<MapRendererProps> = ({ spec, height = '360px', onMarkerClick }) => {
  if (!spec || !spec.center) {
    return (
      <div className="flex items-center justify-center bg-slate-900/50 border border-slate-800 rounded-lg p-6 text-slate-500 font-mono text-xs">
        Invalid or missing map specification.
      </div>
    );
  }

  // Convert MapSpec layers into MapMarkerItems
  const markers: MapMarkerItem[] = [];

  (spec.layers || []).forEach((layer) => {
    if (layer.type === 'markers' || layer.type === 'heatmap') {
      (layer.data || []).forEach((pt: any, idx: number) => {
        markers.push({
          id: pt.id || `marker-${idx}`,
          lat: pt.lat ?? pt.latitude,
          lng: pt.lng ?? pt.longitude,
          title: pt.title || pt.name || pt.description || 'Incident',
          severity: pt.severity || 'MEDIUM',
          wasteType: pt.wasteType || pt.category,
          status: pt.status,
          isHotspot: false,
        });
      });
    } else if (layer.type === 'hotspot_circles' || layer.type === 'polygons') {
      (layer.data || []).forEach((hs: any, idx: number) => {
        markers.push({
          id: hs.id || `hotspot-${idx}`,
          lat: hs.lat ?? hs.centerLatitude,
          lng: hs.lng ?? hs.centerLongitude,
          title: hs.name || hs.dominantWasteType || 'Hotspot Zone',
          severity: hs.severity || 'CRITICAL',
          wasteType: hs.dominantWasteType,
          status: hs.status,
          isHotspot: true,
          radius: hs.radius || 250,
        });
      });
    }
  });

  return (
    <div className="w-full">
      <EnvironmentalMap
        center={[spec.center.lat, spec.center.lng]}
        zoom={spec.zoom || 13}
        height={height}
        markers={markers}
        onMarkerClick={onMarkerClick}
      />
    </div>
  );
};
