import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL,
  AdMediatorName,
  AdRevenuePrecision,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { RevenuePrecisions, type PaidEvent } from 'react-native-google-mobile-ads';

// RevenueCat API Keys - Use environment variable with fallback
const REVENUECAT_API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'goog_HcNKJszQnkNPgLUjQvOqgkSxjqj',
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'appl_CRtAAkRCMobOPrYXnEvjgHHLGZJ',
  default: 'appl_CRtAAkRCMobOPrYXnEvjgHHLGZJ',
}) as string;

// Entitlement identifiers
export const ENTITLEMENTS = {
  BOOST_ACTIVE: 'boost_active',
} as const;

// Product identifiers - Must match App Store Connect + RevenueCat
export const PRODUCT_IDS = {
  LIFETIME: 'lifetime',
  BOOST_7D: 'boost_7d_v2',
  BOOST_1M: 'boost_1m_v2',
  BOOST_1Y: 'boost_1y_v2',
} as const;

/**
 * Initialize RevenueCat SDK
 * Should be called once when the app starts
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    const alreadyConfigured = await Purchases.isConfigured();
    if (alreadyConfigured) {
      return;
    }

    Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId,
    });

    console.log('✅ RevenueCat initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize RevenueCat:', error);
    throw error;
  }
}

/**
 * Get current customer info including entitlements and active subscriptions
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('❌ Failed to get customer info:', error);
    return null;
  }
}

/**
 * Check if user has active boost entitlement
 */
export async function hasActiveBoost(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENTS.BOOST_ACTIVE];
    return entitlement !== undefined;
  } catch (error) {
    console.error('❌ Failed to check boost entitlement:', error);
    return false;
  }
}

/**
 * Get available offerings (products configured in RevenueCat dashboard)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();

    console.log('[RC] All offerings keys:', Object.keys(offerings.all));
    console.log('[RC] Current offering:', offerings.current?.identifier ?? 'null');

    if (offerings.current !== null) {
      const pkgs = offerings.current.availablePackages;
      console.log(`[RC] Packages in current offering (${pkgs.length}):`);
      pkgs.forEach((pkg, i) => {
        console.log(
          `[RC]   [${i}] identifier=${pkg.identifier}` +
            ` | productId=${pkg.product.identifier}` +
            ` | title=${pkg.product.title}` +
            ` | price=${pkg.product.priceString}` +
            ` | type=${pkg.packageType}`
        );
      });
      return offerings.current;
    }

    console.warn('[RC] ⚠️ No current offering available');
    return null;
  } catch (error) {
    console.error('[RC] ❌ Failed to get offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage
): Promise<{ customerInfo: CustomerInfo; transaction: any; success: boolean }> {
  try {
    const { customerInfo, transaction } = await Purchases.purchasePackage(packageToPurchase);
    console.log('✅ Purchase successful:', customerInfo);
    return { customerInfo, transaction, success: true };
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('ℹ️ User cancelled purchase');
    } else {
      console.error('❌ Purchase failed:', error);
    }
    throw error;
  }
}

/**
 * Restore purchases
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('✅ Purchases restored:', customerInfo);
    return customerInfo;
  } catch (error) {
    console.error('❌ Failed to restore purchases:', error);
    throw error;
  }
}

/**
 * Set user ID for RevenueCat
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
    console.log('✅ User identified:', userId);
  } catch (error) {
    console.error('❌ Failed to identify user:', error);
    throw error;
  }
}

/**
 * Logout current user
 */
export async function logoutUser(): Promise<void> {
  try {
    await Purchases.logOut();
    console.log('✅ User logged out');
  } catch (error) {
    console.error('❌ Failed to logout user:', error);
    throw error;
  }
}

/**
 * Get active subscription info
 */
export async function getActiveSubscriptionInfo(): Promise<{
  isActive: boolean;
  productIdentifier?: string;
  expirationDate?: string | null;
  willRenew?: boolean;
} | null> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const activeEntitlements = customerInfo.entitlements.active;

    if (Object.keys(activeEntitlements).length === 0) {
      return { isActive: false };
    }

    // Get the first active entitlement
    const firstEntitlement = Object.values(activeEntitlements)[0];

    return {
      isActive: true,
      productIdentifier: firstEntitlement.productIdentifier,
      expirationDate: firstEntitlement.expirationDate,
      willRenew: firstEntitlement.willRenew,
    };
  } catch (error) {
    console.error('❌ Failed to get subscription info:', error);
    return null;
  }
}

/**
 * Check if user has any active entitlement
 */
export async function hasAnyActiveEntitlement(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return Object.keys(customerInfo.entitlements.active).length > 0;
  } catch (error) {
    console.error('❌ Failed to check entitlements:', error);
    return false;
  }
}

/**
 * Get all entitlements (active and inactive)
 */
export async function getAllEntitlements(): Promise<Record<string, any>> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.all;
  } catch (error) {
    console.error('❌ Failed to get all entitlements:', error);
    return {};
  }
}

// AdMob RevenuePrecisions -> RevenueCat AdRevenuePrecision. Ambos SDKs usan
// vocabularios distintos para el mismo concepto de "impression-level ad
// revenue".
const AD_REVENUE_PRECISION_MAP: Record<RevenuePrecisions, AdRevenuePrecision> = {
  [RevenuePrecisions.PRECISE]: AdRevenuePrecision.exact,
  [RevenuePrecisions.PUBLISHER_PROVIDED]: AdRevenuePrecision.publisherDefined,
  [RevenuePrecisions.ESTIMATED]: AdRevenuePrecision.estimated,
  [RevenuePrecisions.UNKNOWN]: AdRevenuePrecision.unknown,
};

/**
 * Genera un id único por impresión de anuncio, para correlacionar los
 * eventos load/show/paid de una misma impresión en RevenueCat.
 */
export function generateAdImpressionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Reenvía a RevenueCat (Ad Monetization / Manual Ad Tracking) el ingreso
 * generado por un anuncio de AdMob, para que aparezca junto al revenue de
 * compras en el dashboard. No lanza si falla, para no interrumpir el flujo
 * del anuncio por un error de reporting.
 */
export async function trackAdRevenue({
  event,
  adUnitId,
  adFormat,
  placement,
  impressionId,
}: {
  event: PaidEvent;
  adUnitId: string;
  adFormat: string;
  placement: string;
  impressionId: string;
}): Promise<void> {
  try {
    await Purchases.adTracker.trackAdRevenue({
      mediatorName: AdMediatorName.adMob,
      networkName: AdMediatorName.adMob,
      adFormat,
      adUnitId,
      impressionId,
      placement,
      revenueMicros: Math.round(event.value * 1_000_000),
      currency: event.currency,
      precision: AD_REVENUE_PRECISION_MAP[event.precision] ?? AdRevenuePrecision.unknown,
    });
  } catch (error) {
    console.error('❌ Failed to track ad revenue:', error);
  }
}
