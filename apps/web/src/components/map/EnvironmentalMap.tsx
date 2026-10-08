import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapMarkerItem {
  id: string;
  lat: number;
  lng: number;
  title: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  wasteType?: string;
  status?: string;
  isHotspot?: boolean;
  radius?: number; // meters for hotspots
}

interface EnvironmentalMapProps {
  markers?: MapMarkerItem[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (marker: MapMarkerItem) => void;
  showHotspotRadii?: boolean;
  interactive?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  LOW: '#10b981',       // emerald
  MEDIUM: '#3b82f6',    // blue
  HIGH: '#f59e0b',      // amber
  CRITICAL: '#ef4444',  // red
};

export const EnvironmentalMap: React.FC<EnvironmentalMapProps> = ({
  markers = [],
  center = [18.5204, 73.8567], // Pune coordinates default
  zoom = 13,
  height = '100%',
  onMarkerClick,
  showHotspotRadii = true,
  interactive = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
    });

    // Standard OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    // Invalidate size after layout settles
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Update center & zoom if changed
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom, { animate: true });
    }
  }, [center[0], center[1], zoom]);

  // Update Markers & Circles
  useEffect(() => {
    if (!layerGroupRef.current || !mapInstanceRef.current) return;

    layerGroupRef.current.clearLayers();

    markers.forEach((item) => {
      if (typeof item.lat !== 'number' || typeof item.lng !== 'number' || isNaN(item.lat) || isNaN(item.lng)) {
        return;
      }

      const color = SEVERITY_COLORS[item.severity?.toUpperCase() || 'MEDIUM'] || '#3b82f6';

      if (item.isHotspot) {
        // Hotspot Circle
        if (showHotspotRadii && item.radius) {
          const circle = L.circle([item.lat, item.lng], {
            radius: item.radius,
            color: '#ef4444',
            weight: 1.5,
            opacity: 0.8,
            fillColor: '#ef4444',
            fillOpacity: 0.15,
            dashArray: '4, 4',
          });
          circle.addTo(layerGroupRef.current!);
        }

        // Hotspot Central Pulse Marker
        const hotspotIcon = L.divIcon({
          className: 'custom-hotspot-pin',
          html: `
            <div style="position:relative; width: 28px; height: 28px; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; width: 28px; height: 28px; border-radius:50%; background: rgba(239, 68, 68, 0.25); animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 14px; height: 14px; border-radius:50%; background:#ef4444; border: 2px solid #ffffff; box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);"></div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([item.lat, item.lng], { icon: hotspotIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
            <div style="font-weight: 700; color: #f87171; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em;">Hotspot Area</div>
            <div style="font-weight: 600; color: #f1f5f9; margin-top: 2px;">${item.title}</div>
            <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Dominant: <span style="color: #cbd5e1;">${item.wasteType || 'General Waste'}</span></div>
            ${item.radius ? `<div style="color: #94a3b8; font-size: 11px;">Radius: ${item.radius}m</div>` : ''}
          </div>
        `);

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(item));
        }

        marker.addTo(layerGroupRef.current!);
      } else {
        // Incident / Event Marker
        const eventIcon = L.divIcon({
          className: 'custom-event-pin',
          html: `
            <div style="width: 18px; height: 18px; border-radius:50%; background: ${color}; border: 2px solid #0f172a; box-shadow: 0 2px 6px rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; cursor: pointer; transition: transform 0.2s;">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #ffffff;"></div>
            </div>
          `,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        const marker = L.marker([item.lat, item.lng], { icon: eventIcon });
        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4;">
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 10px; font-weight: 700; color: ${color}; text-transform: uppercase;">${item.severity || 'EVENT'}</span>
              <span style="font-size: 10px; color: #94a3b8;">${item.status || 'ACTIVE'}</span>
            </div>
            <div style="font-weight: 600; color: #f1f5f9;">${item.title}</div>
            ${item.wasteType ? `<div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">Category: <span style="color: #cbd5e1;">${item.wasteType}</span></div>` : ''}
          </div>
        `);

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(item));
        }

        marker.addTo(layerGroupRef.current!);
      }
    });
  }, [markers, showHotspotRadii, onMarkerClick]);

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
