export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Standard ray-casting algorithm (even-odd rule) to check if a point [lat, lng]
 * is strictly inside a GeoJSON Polygon or MultiPolygon.
 * Coordinates in GeoJSON are ordered as [longitude, latitude].
 */
export function isPointInPolygon(point: GeoPoint, geoJson: any): boolean {
  if (!geoJson || !geoJson.type || !geoJson.coordinates) {
    return false;
  }

  const { lat, lng } = point;

  if (geoJson.type === 'Polygon') {
    return isPointInLinearRing(lat, lng, geoJson.coordinates[0]);
  }

  if (geoJson.type === 'MultiPolygon') {
    for (const polygon of geoJson.coordinates) {
      if (isPointInLinearRing(lat, lng, polygon[0])) {
        return true;
      }
    }
  }

  return false;
}

function isPointInLinearRing(lat: number, lng: number, ring: [number, number][]): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]; // lng
    const yi = ring[i][1]; // lat
    const xj = ring[j][0]; // lng
    const yj = ring[j][1]; // lat

    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculates the great-circle distance between two points on Earth using the Haversine formula.
 * Returns distance in meters.
 */
export function haversineDistanceM(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371000; // Earth radius in meters
  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lng - p1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates bounding box [minLat, maxLat, minLng, maxLng] from a set of polygon coordinates.
 */
export function computeBoundingBox(ring: [number, number][]): BoundingBox {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return { minLat, maxLat, minLng, maxLng };
}
