import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat API Keys - Use environment variable with fallback
const REVENUECAT_API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'goog_HcNKJszQnkNPgLUjQvOqgkSxjqj',
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'appl_CRtAAkRCMobOPrYXnEvjgHHLGZJ',
  default: 'appl_CRtAAkRCMobOPrYXnEvjgHHLGZJ',
}) as string;

// Product identifiers - Must match App Store Connect / Google Play + RevenueCat.
// Son productos de pago único (consumibles): se pueden comprar varias veces.
export const PRODUCT_IDS = {
  BOOST_7D: 'boost_7d_v2',
  BOOST_1M: 'boost_1m_v2',
  BOOST_1Y: 'boost_1y_v2',
} as const;

/**
 * Atributo de suscriptor con el bar al que va el boost. Viaja en el webhook
 * (`event.subscriber_attributes`) y permite al servidor asignar la compra
 * aunque el insert del cliente no llegue.
 */
export const BOOST_BAR_ATTRIBUTE = 'boost_bar_id';

/**
 * Initialize RevenueCat SDK. Should be called once when the app starts.
 * `configure` es síncrono: después de esta llamada el SDK ya se puede usar.
 */
export async function initializeRevenueCat(userId?: string | null): Promise<void> {
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  if (await Purchases.isConfigured()) {
    return;
  }

  Purchases.configure({
    apiKey: REVENUECAT_API_KEY,
    appUserID: userId ?? undefined,
  });
}

/**
 * Asegura que el App User ID de RevenueCat es el id del usuario de Supabase.
 * Sin esto la compra queda en un `$RCAnonymousID` y el webhook no puede
 * relacionarla con el dueño del bar.
 */
export async function syncRevenueCatUser(userId: string): Promise<void> {
  if (!(await Purchases.isConfigured())) {
    await initializeRevenueCat(userId);
    return;
  }
  const current = await Purchases.getAppUserID();
  if (current !== userId) {
    await Purchases.logIn(userId);
  }
}

/** Vuelve a un usuario anónimo de RevenueCat al cerrar sesión. */
export async function logoutRevenueCatUser(): Promise<void> {
  if (!(await Purchases.isConfigured())) return;
  if (await Purchases.isAnonymous()) return; // logOut lanza error si ya es anónimo
  await Purchases.logOut();
}
