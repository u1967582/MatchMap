import Purchases, { 
  PurchasesPackage, 
  CustomerInfo,
  PurchasesOffering,
  LOG_LEVEL
} from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat API Keys - Use environment variable with fallback
const REVENUECAT_API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'goog_HcNKJszQnkNPgLUjQv0qgKsXjqj',
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'test_sMBliApmNvBxEUAAIamKYkUFExu',
  default: 'test_sMBliApmNvBxEUAAIamKYkUFExu',
}) as string;

// Entitlement identifiers
export const ENTITLEMENTS = {
  BOOST_ACTIVE: 'boost_active',
} as const;

// Product identifiers
export const PRODUCT_IDS = {
  LIFETIME: 'lifetime',
} as const;

/**
 * Initialize RevenueCat SDK
 * Should be called once when the app starts
 */
export async function initializeRevenueCat(userId?: string): Promise<void> {
  try {
    // Configure SDK
    Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
      appUserID: userId, // Optional: pass user ID for identification
    });

    // Set debug logs in development
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

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
    if (offerings.current !== null) {
      return offerings.current;
    }
    console.warn('⚠️ No current offering available');
    return null;
  } catch (error) {
    console.error('❌ Failed to get offerings:', error);
    return null;
  }
}

/**
 * Purchase a package
 */
export async function purchasePackage(
  packageToPurchase: PurchasesPackage
): Promise<{ customerInfo: CustomerInfo; success: boolean }> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
    console.log('✅ Purchase successful:', customerInfo);
    return { customerInfo, success: true };
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
  expirationDate?: string;
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
