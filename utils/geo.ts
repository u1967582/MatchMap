/**
 * Geographic utilities for distance calculation
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param point1 First coordinate
 * @param point2 Second coordinate
 * @returns Distance in kilometers
 */
export function haversineDistance(point1: LatLng, point2: LatLng): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.lat)) *
      Math.cos(toRadians(point2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Round coordinates to N decimal places for consistent seeding
 */
export function roundCoordinate(value: number, decimals: number = 3): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate distance in meters between two lat/lng pairs (Haversine).
 * Used for proximity validation (e.g. 500m radius check).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistance({ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 }) * 1000;
}

/**
 * Filtra qué bares (con lat/lng) están dentro de un radio en metros desde
 * un punto dado. Usado para la detección de proximidad (ver
 * checkBarProximity en components/Map.tsx).
 */
export function getNearbyBarIds(
  coords: { latitude: number; longitude: number },
  bars: { id: string; latitude: number; longitude: number }[],
  radiusMeters: number
): string[] {
  return bars
    .filter(
      (bar) =>
        haversineDistanceMeters(coords.latitude, coords.longitude, bar.latitude, bar.longitude) <=
        radiusMeters
    )
    .map((bar) => bar.id);
}

/**
 * Create a deterministic key from coordinates for stable random selection
 */
export function coordsToKey(coords: LatLng, decimals: number = 3): string {
  const lat = roundCoordinate(coords.lat, decimals);
  const lng = roundCoordinate(coords.lng, decimals);
  return `${lat}|${lng}`;
}
