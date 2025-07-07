declare module '@rnmapbox/maps' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface MapViewProps extends ViewProps {
    styleURL?: string;
  }

  class MapView extends Component<MapViewProps> {}

  const StyleURL: {
    Street: string;
    Dark: string;
    Light: string;
    Outdoors: string;
    Satellite: string;
    SatelliteStreet: string;
    TrafficDay: string;
    TrafficNight: string;
  };

  export function setAccessToken(token: string): void;
  export function setTelemetryEnabled(enabled: boolean): void;
  export { MapView, StyleURL };
} 