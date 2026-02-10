# RevenueCat Quick Start Guide

## 🚀 Quick Implementation Checklist

### ✅ Step 1: Installation (DONE)
```bash
npm install --save react-native-purchases react-native-purchases-ui
```

### ✅ Step 2: Files Created
- ✅ `utils/revenuecat.ts` - Core SDK wrapper
- ✅ `contexts/RevenueCatContext.tsx` - React Context provider
- ✅ `components/revenuecat/Paywall.tsx` - Paywall UI
- ✅ `components/revenuecat/CustomerCenter.tsx` - Customer management UI
- ✅ `app/_layout.tsx` - Updated with RevenueCatProvider
- ✅ `app/boost/BoostScreen.tsx` - Updated with RevenueCat integration

---

## 🎯 How to Use

### 1. Check if User Has Active Boost

```typescript
import { useRevenueCat } from '~/contexts/RevenueCatContext';

function MyComponent() {
  const { hasActiveBoost, isLoading } = useRevenueCat();
  
  if (isLoading) return <ActivityIndicator />;
  
  return (
    <View>
      {hasActiveBoost ? (
        <Text>✅ Boost Active!</Text>
      ) : (
        <Text>❌ No Boost</Text>
      )}
    </View>
  );
}
```

### 2. Show Paywall for Purchase

```typescript
import { useState } from 'react';
import Paywall from '~/components/revenuecat/Paywall';

function BoostButton() {
  const [showPaywall, setShowPaywall] = useState(false);
  
  return (
    <>
      <Button 
        title="Get Boost" 
        onPress={() => setShowPaywall(true)} 
      />
      
      <Paywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPurchaseComplete={() => {
          setShowPaywall(false);
          Alert.alert('Success', 'Boost activated!');
        }}
      />
    </>
  );
}
```

### 3. Show Customer Center

```typescript
import { useState } from 'react';
import CustomerCenter from '~/components/revenuecat/CustomerCenter';

function ProfileSettings() {
  const [showCenter, setShowCenter] = useState(false);
  
  return (
    <>
      <Button 
        title="Manage Subscription" 
        onPress={() => setShowCenter(true)} 
      />
      
      <CustomerCenter
        visible={showCenter}
        onClose={() => setShowCenter(false)}
      />
    </>
  );
}
```

### 4. Restore Purchases

```typescript
import { useRevenueCat } from '~/contexts/RevenueCatContext';

function RestoreButton() {
  const { restorePurchases } = useRevenueCat();
  const [loading, setLoading] = useState(false);
  
  const handleRestore = async () => {
    try {
      setLoading(true);
      await restorePurchases();
      Alert.alert('Success', 'Purchases restored!');
    } catch (error) {
      Alert.alert('Error', 'Could not restore purchases');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button 
      title="Restore Purchases" 
      onPress={handleRestore}
      disabled={loading}
    />
  );
}
```

---

## 🔧 RevenueCat Dashboard Setup (TODO)

### Step 1: Create Project
1. Go to [RevenueCat Dashboard](https://app.revenuecat.com)
2. Create new project: "MatchMap"
3. Add iOS and Android apps

### Step 2: Configure Products
Create product with identifier: `lifetime`

```
Product ID: lifetime
Type: Non-consumable (iOS) / One-time (Android)
Price: Configure in App Store / Play Console
```

### Step 3: Create Entitlement
```
Entitlement ID: boost_active
Linked Products: lifetime
```

### Step 4: Create Offering
```
Offering Identifier: default
Package Identifier: lifetime
Product: lifetime
```

### Step 5: Get API Keys
1. Go to Project Settings → API Keys
2. Copy **Public App-Specific API Key**
3. Replace test key in `utils/revenuecat.ts`

---

## 📱 App Store / Play Console Setup

### iOS (App Store Connect)
1. Create in-app purchase: `lifetime`
2. Type: Non-consumable
3. Set pricing tier
4. Add descriptions and screenshots
5. Submit with app review

### Android (Google Play Console)
1. Go to Monetize → Products → In-app products
2. Create product ID: `lifetime`
3. Set pricing
4. Add descriptions
5. Activate product

---

## 🧪 Testing

### Test with Sandbox Account

**iOS:**
1. Settings → App Store → Sandbox Account
2. Sign in with sandbox tester
3. Make purchase in app
4. Payment will not charge real money

**Android:**
1. Add tester email to Play Console
2. Sign in with Google account
3. Make purchase (closed testing or internal testing)
4. No real charge

### Verify in Dashboard
1. Go to RevenueCat Dashboard → Customers
2. Find your test user
3. Verify entitlement is active
4. Check transaction appears

---

## ⚠️ Important Notes

### Test vs Production
- **Current**: Using test API key
- **Production**: Replace with production key before release

### Entitlement Identifiers
- Must match exactly between:
  - RevenueCat dashboard
  - Code (`utils/revenuecat.ts`)
  
### Product Identifiers
- Must match exactly between:
  - App Store Connect / Play Console
  - RevenueCat Dashboard
  - Your app code

---

## 🐛 Common Issues

### "No offerings available"
**Fix:** Ensure offerings are configured in RevenueCat dashboard

### "Purchase failed"
**Fix:** 
- Check sandbox account is configured
- Verify product is set up in store console
- Review RevenueCat logs

### "Entitlement not granted after purchase"
**Fix:**
- Check entitlement configuration in dashboard
- Verify product is linked to entitlement
- Wait 30 seconds and refresh

---

## 📞 Support

- **RevenueCat Docs**: https://docs.revenuecat.com
- **Dashboard**: https://app.revenuecat.com
- **Community**: https://community.revenuecat.com

---

## ✅ Integration Status

- [x] SDK installed
- [x] Core service implemented
- [x] Context provider created
- [x] Paywall UI built
- [x] Customer Center built
- [x] BoostScreen updated
- [x] App layout configured
- [ ] RevenueCat dashboard configured (TODO)
- [ ] Products created in stores (TODO)
- [ ] Test purchases verified (TODO)
- [ ] Production API key added (TODO)

---

**Next Step:** Configure RevenueCat Dashboard and create products in App Store / Play Console
