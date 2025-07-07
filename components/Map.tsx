import Mapbox, { Camera, MapView, LocationPuck } from '@rnmapbox/maps';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '');

export default function Map() {
  return (
    <MapView style={{ flex: 1 }} styleURL='mapbox://styles/mapbox/dark-v11'>
      <Camera followZoomLevel={15} followUserLocation/>
      <LocationPuck puckBearingEnabled={true} puckBearing='heading' pulsing={true}/>
    </MapView>
  );
}