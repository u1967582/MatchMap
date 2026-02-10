# RevenueCat Testing & Implementation Guide

## Testing

### Sandbox Testing (iOS)

Configure sandbox environment for iOS testing:

```typescript
import Purchases from 'react-native-purchases';

// Enable debug logging in development
if (__DEV__) {
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
}
```

**Setup sandbox testers:**
1. Go to App Store Connect
2. Navigate to Settings → Users and Access → Sandbox Testers
3. Create test accounts with valid email addresses
4. Use these accounts to test purchases in development builds

**Important notes:**
- Sandbox purchases don't charge real money
- Subscriptions renew much faster in sandbox (e.g., 1 month = 5 minutes)
- Always sign out of real App Store account before testing
- Clear app data between tests to avoid cached states

### Test Cards (Android)

Configure license testing for Android:

**Google Play Console setup:**
1. Go to Google Play Console → Testing → License Testing
2. Add test emails (e.g., test@example.com)
3. Use test card numbers for purchases

**Test card numbers:**
- `4242 4242 4242 4242` - Successful payment
- Any future expiry date and CVC

**Testing process:**
1. Add test email to License Testing
2. Sign in with test account on device
3. Make test purchases (no real charges)
4. Verify entitlements are granted correctly

---

## Implementation Checklist

### Setup Inicial

Initial configuration steps:

- [ ] RevenueCat cuenta creada
- [ ] Proyecto configurado en RevenueCat dashboard
- [ ] API Keys obtenidas:
  - [ ] iOS API Key (appl_...)
  - [ ] Android API Key (goog_...)
- [ ] Plugin instalado en app.json:
  ```json
  {
    "plugins": [
      [
        "react-native-purchases",
        {
          "apiKey": "appl_...",
          "androidApiKey": "goog_..."
        }
      ]
    ]
  }
  ```
- [ ] Inicialización en `app/_layout.tsx`:
  ```typescript
  Purchases.configure({ apiKey });
  ```

### Productos

Product configuration in stores and RevenueCat:

- [ ] Productos creados en App Store Connect:
  - [ ] matchmap_boost_1_month
  - [ ] matchmap_boost_3_months
  - [ ] matchmap_boost_6_months
- [ ] Productos creados en Google Play Console
- [ ] Productos importados a RevenueCat dashboard
- [ ] Offerings configuradas:
  - [ ] "default" offering created
  - [ ] Packages assigned to offering
- [ ] Entitlements definidos:
  - [ ] "premium" entitlement created
  - [ ] Products linked to entitlement

### Código

Implementation checklist for app code:

- [ ] Login/Logout con RevenueCat:
  ```typescript
  await Purchases.logIn(userId);
  await Purchases.logOut();
  ```
- [ ] Obtener offerings:
  ```typescript
  const offerings = await Purchases.getOfferings();
  ```
- [ ] Realizar compras:
  ```typescript
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  ```
- [ ] Verificar entitlements:
  ```typescript
  const isPremium = customerInfo.entitlements.active['premium'] !== undefined;
  ```
- [ ] Restore purchases:
  ```typescript
  const customerInfo = await Purchases.restorePurchases();
  ```
- [ ] Sincronización con Supabase:
  - [ ] Guardar boost en `bar_boosts` table después de compra
  - [ ] Actualizar estado de boost basado en webhooks
- [ ] Manejo de errores completo:
  - [ ] PURCHASE_CANCELLED_ERROR
  - [ ] PURCHASE_NOT_ALLOWED_ERROR
  - [ ] PURCHASE_INVALID_ERROR
  - [ ] NETWORK_ERROR

### Backend

Backend setup for webhook processing:

- [ ] Tabla `bar_boosts` en Supabase:
  ```sql
  CREATE TABLE bar_boosts (
    id uuid PRIMARY KEY,
    bar_id uuid REFERENCES bars(id),
    user_id uuid REFERENCES auth.users(id),
    status text CHECK (status IN ('active', 'expired')),
    end_at timestamptz,
    revenuecat_product_id text,
    revenuecat_transaction_id text,
    created_at timestamptz DEFAULT now()
  );
  ```
- [ ] Edge Function para webhooks:
  - [ ] Deploy `scripts/revenuecat-webhook.ts` to Supabase
  - [ ] Configure environment variables (SUPABASE_URL, SERVICE_ROLE_KEY)
  - [ ] Test webhook locally with mock events
- [ ] Webhooks configurados en RevenueCat:
  - [ ] URL: `https://[project].supabase.co/functions/v1/revenuecat-webhook`
  - [ ] Authorization header configured
  - [ ] Events enabled: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
- [ ] Políticas RLS en `bar_boosts`:
  - [ ] Users can view their own boosts
  - [ ] Service role can update all boosts (for webhooks)

### Testing

Final testing before production:

- [ ] Sandbox testing completado (iOS)
- [ ] License testing completado (Android)
- [ ] Compras probadas en ambas plataformas
- [ ] Restore purchases probado
- [ ] Webhooks probados:
  - [ ] Purchase creates boost
  - [ ] Renewal extends boost
  - [ ] Cancellation/Expiration deactivates boost
- [ ] Sincronización Supabase verificada
- [ ] Error handling verificado (cancel, network errors, etc.)
- [ ] UI feedback probado (loading, success, error states)

---

## Common Issues

### Issue: Purchases not restoring
**Solution:** Ensure user is logged in with RevenueCat before restoring:
```typescript
await Purchases.logIn(userId);
await Purchases.restorePurchases();
```

### Issue: Webhooks not received
**Solution:**
1. Check webhook URL in RevenueCat dashboard
2. Verify authorization header is correct
3. Check Supabase Edge Function logs
4. Test webhook manually with RevenueCat's test tool

### Issue: Entitlements not showing up
**Solution:**
1. Verify product IDs match in App Store Connect and RevenueCat
2. Check that products are linked to "premium" entitlement
3. Ensure offering is set as "current" in RevenueCat

### Issue: Sandbox purchases failing
**Solution:**
1. Sign out of real App Store account
2. Delete and reinstall app
3. Ensure sandbox tester account is valid
4. Check that product is available in sandbox environment
