---
name: revenuecat
description: This skill should be used when implementing in-app purchases, subscriptions, entitlements verification, restore purchases, and webhook integration with RevenueCat for the MatchMap boost system.
---

# RevenueCat Skill para MatchMap

## Purpose

Provides patterns and workflows for implementing RevenueCat-based in-app purchases and subscriptions for MatchMap's boost feature, including user management, purchase flows, entitlement verification, and backend synchronization with Supabase.

## Initialization

Configure RevenueCat in `app/_layout.tsx`:

```typescript
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

useEffect(() => {
  async function initRevenueCat() {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    const apiKey = Platform.select({
      ios: Constants.expoConfig?.extra?.revenuecatApiKeyIos,
      android: Constants.expoConfig?.extra?.revenuecatApiKeyAndroid,
    });

    if (apiKey) {
      Purchases.configure({ apiKey });
    }
  }

  initRevenueCat();
}, []);
```

## User Identification

**Login:** Identify user with Supabase user ID after authentication:
```typescript
await Purchases.logIn(userId);
```

**Logout:** Clear RevenueCat user when signing out:
```typescript
await Purchases.logOut();
```

**Why:** Enables purchase restoration across devices and proper entitlement management.

## Products and Offerings

### Get Available Offerings

```typescript
async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current !== null ? offerings : null;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
}
```

### Display Package Information

```typescript
// Access package details
const pkg = offerings.current.availablePackages[0];

console.log(pkg.product.priceString); // "$4.99"
console.log(pkg.product.identifier); // "matchmap_boost_1_month"
console.log(pkg.product.description); // Product description

// Check for introductory offer
if (pkg.product.introPrice) {
  console.log(pkg.product.introPrice.priceString); // "$0.99"
}
```

## Purchase Flow

### Execute Purchase

```typescript
async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // Verify entitlement
    if (customerInfo.entitlements.active['premium']) {
      toast.success('¡Compra exitosa!');
      return true;
    }

    toast.error('Error en la compra');
    return false;
  } catch (error: any) {
    if (error.userCancelled) {
      return false; // User cancelled, no error message needed
    }

    // Handle specific error codes
    switch (error.code) {
      case Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        toast.error('Compra no permitida');
        break;
      case Purchases.PURCHASES_ERROR_CODE.NETWORK_ERROR:
        toast.error('Error de red');
        break;
      default:
        toast.error('Error en la compra', error.message);
    }

    return false;
  }
}
```

## Entitlement Verification

### Check Premium Status

```typescript
async function isPremiumUser(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['premium'] !== undefined;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
}
```

### Hook for Premium Status

```typescript
export function usePremiumStatus() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      const premium = await isPremiumUser();
      setIsPremium(premium);
      setLoading(false);
    }

    checkStatus();

    // Listen for purchase updates
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      setIsPremium(customerInfo.entitlements.active['premium'] !== undefined);
    });
  }, []);

  return { isPremium, loading };
}
```

## Restore Purchases

```typescript
async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();

    if (customerInfo.entitlements.active['premium']) {
      toast.success('Compras restauradas');
      return true;
    }

    toast.info('Sin compras previas');
    return false;
  } catch (error) {
    toast.error('Error al restaurar');
    return false;
  }
}
```

## Supabase Synchronization

### Save Boost After Purchase

```typescript
async function syncBoostWithSupabase(
  barId: string,
  productIdentifier: string
): Promise<void> {
  const customerInfo = await Purchases.getCustomerInfo();
  const entitlement = customerInfo.entitlements.active['premium'];

  if (!entitlement) {
    throw new Error('No active entitlement');
  }

  // Calculate duration from product ID
  const durationDays = productIdentifier.includes('monthly') ? 30
    : productIdentifier.includes('three_month') ? 90
    : 180;

  const endAt = new Date();
  endAt.setDate(endAt.getDate() + durationDays);

  // Insert into Supabase
  const { data, error } = await supabase
    .from('bar_boosts')
    .insert({
      bar_id: barId,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      status: 'active',
      end_at: endAt.toISOString(),
      revenuecat_product_id: productIdentifier,
      revenuecat_transaction_id: entitlement.originalPurchaseDate,
    })
    .select()
    .single();

  if (error) throw error;
}
```

### Check Active Boost

```typescript
async function hasActiveBoost(barId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('bar_boosts')
    .select('id')
    .eq('bar_id', barId)
    .eq('status', 'active')
    .gte('end_at', new Date().toISOString())
    .single();

  return data !== null;
}
```

## Webhook Integration

### Setup

Deploy the webhook Edge Function from `scripts/revenuecat-webhook.ts` to Supabase:

```bash
supabase functions deploy revenuecat-webhook
```

### Configure in RevenueCat Dashboard

1. Navigate to Project → Integrations → Webhooks
2. Set URL: `https://[project].supabase.co/functions/v1/revenuecat-webhook`
3. Add authorization header: `Bearer [secret-key]`
4. Enable events:
   - INITIAL_PURCHASE
   - RENEWAL
   - CANCELLATION
   - EXPIRATION

### How It Works

The webhook automatically updates boost status in Supabase when:
- **INITIAL_PURCHASE/RENEWAL**: Sets `status = 'active'`
- **CANCELLATION/EXPIRATION**: Sets `status = 'expired'`

No manual intervention required after setup.

## Common Patterns for MatchMap

### Complete Purchase Flow

```typescript
async function handlePurchase(pkg: PurchasesPackage, barId: string) {
  setLoading(true);

  // 1. Purchase the package
  const success = await purchasePackage(pkg);

  if (success) {
    // 2. Sync with Supabase
    await syncBoostWithSupabase(barId, pkg.product.identifier);

    // 3. Show success and navigate
    toast.success('¡Boost activado!');
    router.back();
  }

  setLoading(false);
}
```

### Conditional UI Based on Premium Status

```typescript
export function BoostButton({ barId }: { barId: string }) {
  const { isPremium, loading } = usePremiumStatus();

  if (loading) return <ActivityIndicator />;

  if (!isPremium) {
    return (
      <AppButton
        label="Desbloquear Boost"
        onPress={() => router.push('/boost-upgrade')}
      />
    );
  }

  return (
    <AppButton
      label="Activar Boost"
      onPress={() => handleActivateBoost(barId)}
    />
  );
}
```

## Testing and Implementation

For complete testing procedures and implementation checklists, see `references/testing-guide.md`.

**Quick reference:**
- **iOS Sandbox**: Use App Store Connect sandbox testers
- **Android**: Configure license testing in Google Play Console
- **Implementation checklist**: Setup, products, code, backend, testing sections

## Product Configuration

MatchMap offers three boost packages:

- **1 Month**: `matchmap_boost_1_month` ($4.99)
- **3 Months**: `matchmap_boost_3_months` ($12.99)
- **6 Months**: `matchmap_boost_6_months` ($19.99)

All linked to `premium` entitlement in RevenueCat.

## When to Use This Skill

- Setting up RevenueCat configuration
- Implementing purchase flows
- Checking user entitlements
- Restoring purchases
- Synchronizing purchases with Supabase
- Setting up webhook integration
- Testing IAP in sandbox/license testing
- Handling purchase errors and edge cases
