import { useState, useCallback } from 'react';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1Ijoicm9nZXIxN2dvc3QiLCJhIjoiY21jdDlxaG9lMDNveDJqcXVsMTJvMXlvaSJ9.K41sVHLz2k0T8OI0agyp6w';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface DirectionsResponse {
  routes: Array<{
    geometry: {
      coordinates: [number, number][];
      type: string;
    };
    distance: number; // in meters
    duration: number; // in seconds
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        geometry: {
          coordinates: [number, number][];
          type: string;
        };
        maneuver: {
          instruction: string;
          type: string;
        };
      }>;
    }>;
  }>;
}

interface RouteData {
  coordinates: [number, number][];
  distance: number; // in km
  duration: number; // in minutes
  steps: Array<{
    instruction: string;
    distance: number; // in meters
  }>;
}

export const useMapboxDirections = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [travelMode, setTravelMode] = useState<'walking' | 'driving'>('walking');

  const getDirections = useCallback(async (
    origin: Coordinates,
    destination: Coordinates,
    mode: 'walking' | 'driving' = 'walking'
  ): Promise<RouteData | null> => {
    setLoading(true);
    setError(null);

    try {
      // MapBox Directions API endpoint
      // Format: {longitude},{latitude};{longitude},{latitude}
      const coordinatesParam = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
      
      const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${coordinatesParam}?` +
        `geometries=geojson&` +
        `steps=true&` +
        `language=es&` +
        `access_token=${MAPBOX_ACCESS_TOKEN}`;
      
      setTravelMode(mode);

      console.log('🗺️ Fetching directions from MapBox:', {
        origin: `${origin.latitude}, ${origin.longitude}`,
        destination: `${destination.latitude}, ${destination.longitude}`
      });

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`MapBox API error: ${response.status}`);
      }

      const data: DirectionsResponse = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No se encontró ninguna ruta');
      }

      const route = data.routes[0];
      
      // Extract coordinates from geometry
      const coordinates = route.geometry.coordinates;
      
      // Convert distance from meters to km
      const distanceKm = route.distance / 1000;
      
      // Convert duration from seconds to minutes
      const durationMin = route.duration / 60;

      // Extract steps for turn-by-turn navigation
      const steps = route.legs[0]?.steps.map(step => ({
        instruction: step.maneuver.instruction,
        distance: step.distance
      })) || [];

      const routeInfo: RouteData = {
        coordinates,
        distance: distanceKm,
        duration: durationMin,
        steps
      };

      console.log('✅ Directions fetched successfully:', {
        distance: `${distanceKm.toFixed(2)} km`,
        duration: `${durationMin.toFixed(0)} min`,
        points: coordinates.length
      });

      setRouteData(routeInfo);
      return routeInfo;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener direcciones';
      console.error('❌ Error fetching directions:', err);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearRoute = useCallback(() => {
    setRouteData(null);
    setError(null);
  }, []);

  return {
    loading,
    error,
    routeData,
    travelMode,
    getDirections,
    clearRoute
  };
};
