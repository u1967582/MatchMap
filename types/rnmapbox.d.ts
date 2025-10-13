declare module '@rnmapbox/maps' {
  import { Component } from 'react';
  import { ViewProps } from 'react-native';

  interface MapViewProps extends ViewProps {
    styleURL?: string;
    scaleBarEnabled?: boolean;
    logoEnabled?: boolean;
    attributionEnabled?: boolean;
  }

  interface PointAnnotationProps extends ViewProps {
    id: string;
    coordinate: [number, number]; // [longitude, latitude]
    anchor?: { x: number; y: number };
    onSelected?: () => void;
    onDeselected?: () => void;
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

  interface ShapeSourceProps extends ViewProps {
    id: string;
    shape: any; // GeoJSON shape
    cluster?: boolean;
    clusterRadius?: number;
    clusterMaxZoom?: number;
    onPress?: (event: any) => void;
  }

  interface SymbolLayerProps extends ViewProps {
    id: string;
    style?: any;
    filter?: any[];
  }

  interface CircleLayerProps extends ViewProps {
    id: string;
    style?: any;
    filter?: any[];
  }

  interface ImagesProps extends ViewProps {
    images: Record<string, any>;
  }

  class MapView extends Component<MapViewProps> {}
  class PointAnnotation extends Component<PointAnnotationProps> {}
  class Camera extends Component<CameraProps> {}
  class UserLocation extends Component<UserLocationProps> {}
  class LocationPuck extends Component<LocationPuckProps> {}
  class ShapeSource extends Component<ShapeSourceProps> {}
  class SymbolLayer extends Component<SymbolLayerProps> {}
  class CircleLayer extends Component<CircleLayerProps> {}
  class Images extends Component<ImagesProps> {}

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
  export { 
    MapView, 
    PointAnnotation, 
    Camera, 
    UserLocation, 
    LocationPuck, 
    ShapeSource,
    SymbolLayer,
    CircleLayer,
    Images,
    StyleURL 
  };
} 