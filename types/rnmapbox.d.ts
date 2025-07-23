declare module '@rnmapbox/maps' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface MapViewProps extends ViewProps {
    styleURL?: string;
  }

  interface CameraProps {
    followUserLocation?: boolean;
    followZoomLevel?: number;
    centerCoordinate?: [number, number];
    zoomLevel?: number;
    animationDuration?: number;
    onCameraChanged?: () => void;
    ref?: any;
  }

  interface LocationPuckProps {
    puckBearingEnabled?: boolean;
    puckBearing?: string;
    pulsing?: boolean;
  }

  interface CameraSetOptions {
    centerCoordinate: [number, number];
    zoomLevel: number;
    animationDuration?: number;
  }

  class MapView extends Component<MapViewProps> {}
  class Camera extends Component<CameraProps> {
    setCamera(options: CameraSetOptions): void;
  }
  class LocationPuck extends Component<LocationPuckProps> {}

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
  export { MapView, Camera, LocationPuck, StyleURL };
} 