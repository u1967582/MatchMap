declare module '@rnmapbox/maps' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface MapViewProps extends ViewProps {
    styleURL?: string;
  }

  interface PointAnnotationProps extends ViewProps {
    id: string;
    coordinate: [number, number]; // [longitude, latitude]
  }

  interface CameraProps extends ViewProps {
    centerCoordinate?: [number, number]; // [longitude, latitude]
    zoomLevel?: number;
    animationMode?: 'flyTo' | 'easeTo' | 'linearTo';
    animationDuration?: number;
  }

  interface UserLocationProps extends ViewProps {
    visible?: boolean;
    showsUserHeadingIndicator?: boolean;
  }

  interface LocationPuckProps extends ViewProps {
    puckBearingEnabled?: boolean;
    puckBearing?: 'heading' | 'course';
    pulsing?: boolean;
  }

  class MapView extends Component<MapViewProps> {}
  class PointAnnotation extends Component<PointAnnotationProps> {}
  class Camera extends Component<CameraProps> {}
  class UserLocation extends Component<UserLocationProps> {}
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
  export { MapView, PointAnnotation, Camera, UserLocation, LocationPuck, StyleURL };
} 