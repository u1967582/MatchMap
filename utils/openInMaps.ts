import { Linking, Platform } from 'react-native';

export interface MapsDestination {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

function hasValidCoords(dest: MapsDestination): boolean {
  return (
    Number.isFinite(dest.latitude) &&
    Number.isFinite(dest.longitude) &&
    !(dest.latitude === 0 && dest.longitude === 0)
  );
}

/**
 * Construye las URLs para abrir la app de mapas nativa con indicaciones hasta
 * el destino. La primera es la preferida para la plataforma y la última es
 * siempre la web de Google Maps, que funciona en cualquier dispositivo.
 */
export function buildMapsUrls(
  dest: MapsDestination,
  platform: string = Platform.OS
): string[] {
  const coords = `${dest.latitude},${dest.longitude}`;
  const label = encodeURIComponent(dest.name?.trim() || 'Destino');
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${coords}`;

  if (platform === 'ios') {
    // Enlace universal de Apple Maps: no requiere declarar esquemas en
    // LSApplicationQueriesSchemes y abre la app Mapas directamente.
    return [`https://maps.apple.com/?daddr=${coords}&q=${label}`, webUrl];
  }
  if (platform === 'android') {
    return [`geo:0,0?q=${coords}(${label})`, webUrl];
  }
  return [webUrl];
}

/**
 * Abre Apple Maps (iOS) o la app de mapas por defecto (Android) con el
 * destino. Si no se puede abrir ninguna app, usa Google Maps en el navegador.
 * Devuelve false si no hay coordenadas o no se pudo abrir nada.
 */
export async function openInMaps(
  dest: MapsDestination,
  platform: string = Platform.OS
): Promise<boolean> {
  if (!hasValidCoords(dest)) return false;

  const urls = buildMapsUrls(dest, platform);
  // Sin canOpenURL: en iOS/Android 11+ exige declarar esquemas en el
  // manifiesto. openURL rechaza la promesa si nadie puede abrir la URL.
  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Probar con la siguiente URL
    }
  }
  return false;
}

/** Abre el marcador telefónico con el número indicado. */
export async function openPhoneDialer(phone: string): Promise<boolean> {
  const sanitized = phone.replace(/[^\d+]/g, '');
  if (!sanitized) return false;
  try {
    await Linking.openURL(`tel:${sanitized}`);
    return true;
  } catch {
    return false;
  }
}
