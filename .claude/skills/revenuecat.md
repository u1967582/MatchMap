# RevenueCat Skill para MatchMap

## Configuración Inicial

### 1. Instalación
```bash
npm install react-native-purchases

# Configurar en app.json
{
  "expo": {
    "plugins": [
      [
        "react-native-purchases",
        {
          "apiKey": "appl_...", // iOS API Key
          "androidApiKey": "goog_..." // Android API Key (opcional si usas solo iOS)
        }
      ]
    ]
  }
}
```

### 2. Inicialización en App
```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export default function RootLayout() {
  useEffect(() => {
    async function initRevenueCat() {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      const apiKey = Platform.select({
        ios: Constants.expoConfig?.extra?.revenuecatApiKeyIos,
        android: Constants.expoConfig?.extra?.revenuecatApiKeyAndroid,
      });

      if (!apiKey) {
        console.error('RevenueCat API key not found');
        return;
      }

      try {
        Purchases.configure({ apiKey });
        console.log('RevenueCat initialized');
      } catch (error) {
        console.error('Error initializing RevenueCat:', error);
      }
    }

    initRevenueCat();
  }, []);

  return <Stack />;
}
```

---

## Identificación de Usuarios

### 1. Login con Supabase User ID
```typescript
// ✅ CORRECTO: Identificar usuario después de login
import Purchases from 'react-native-purchases';

async function identifyUserInRevenueCat(userId: string) {
  try {
    await Purchases.logIn(userId);
    console.log(`User ${userId} logged in to RevenueCat`);
  } catch (error) {
    console.error('Error logging in to RevenueCat:', error);
  }
}

// Llamar después de login exitoso
async function handleLogin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Identificar en RevenueCat
  await identifyUserInRevenueCat(data.user.id);
}

// ❌ INCORRECTO: No identificar usuario
// RevenueCat usará anonymous ID y las compras no se sincronizarán entre dispositivos
```

### 2. Logout
```typescript
// ✅ CORRECTO: Logout de RevenueCat al cerrar sesión
async function handleLogout() {
  try {
    // 1. Logout de Supabase
    await supabase.auth.signOut();

    // 2. Logout de RevenueCat
    await Purchases.logOut();

    console.log('User logged out');
  } catch (error) {
    console.error('Error logging out:', error);
  }
}
```

---

## Productos y Ofertas

### 1. Configurar Productos en RevenueCat Dashboard
```
Productos (Offerings):

📦 default (Offering predeterminada)
  ├── matchmap_boost_1_month ($4.99)
  ├── matchmap_boost_3_months ($12.99)
  └── matchmap_boost_6_months ($19.99)

Entitlements:
  └── premium (Acceso a features premium)
```

### 2. Obtener Offerings
```typescript
// ✅ CORRECTO: Obtener productos disponibles
import Purchases, { PurchasesOfferings } from 'react-native-purchases';

async function getOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current !== null) {
      return offerings;
    } else {
      console.warn('No offerings available');
      return null;
    }
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
}

// Uso en componente
export function BoostScreen() {
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOfferings() {
      setLoading(true);
      const data = await getOfferings();
      setOfferings(data);
      setLoading(false);
    }

    loadOfferings();
  }, []);

  if (loading) return <LoadingSpinner />;

  const packages = offerings?.current?.availablePackages || [];

  return (
    <View>
      {packages.map((pkg) => (
        <PackageCard key={pkg.identifier} package={pkg} />
      ))}
    </View>
  );
}
```

### 3. Mostrar Información de Paquetes
```typescript
// ✅ CORRECTO: Mostrar precio formateado
import { PurchasesPackage } from 'react-native-purchases';

interface PackageCardProps {
  package: PurchasesPackage;
  onPress: (pkg: PurchasesPackage) => void;
}

export function PackageCard({ package: pkg, onPress }: PackageCardProps) {
  const getPackageTitle = (identifier: string) => {
    switch (identifier) {
      case '$rc_monthly':
        return '1 Mes';
      case '$rc_three_month':
        return '3 Meses';
      case '$rc_six_month':
        return '6 Meses';
      default:
        return identifier;
    }
  };

  return (
    <TouchableOpacity onPress={() => onPress(pkg)}>
      <View style={styles.card}>
        <Text style={styles.title}>{getPackageTitle(pkg.identifier)}</Text>
        <Text style={styles.price}>{pkg.product.priceString}</Text>
        <Text style={styles.description}>{pkg.product.description}</Text>
      </View>
    </TouchableOpacity>
  );
}
```

---

## Realizar Compras

### 1. Comprar Paquete
```typescript
// ✅ CORRECTO: Compra con manejo de errores completo
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { toast } from '~/components/ds';

async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // Verificar si el entitlement está activo
    if (customerInfo.entitlements.active['premium']) {
      toast.success('¡Compra exitosa!', 'Tu boost está activo');
      return true;
    } else {
      toast.error('Error en la compra', 'No se pudo activar tu boost');
      return false;
    }
  } catch (error: any) {
    // Manejar diferentes tipos de errores
    if (error.userCancelled) {
      // Usuario canceló la compra
      console.log('Purchase cancelled by user');
      return false;
    }

    // Errores específicos de RevenueCat
    const errorCode = error.code;

    switch (errorCode) {
      case Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
        console.log('Purchase cancelled');
        break;
      case Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
        toast.error('Compra no permitida', 'Verifica la configuración de tu dispositivo');
        break;
      case Purchases.PURCHASES_ERROR_CODE.PURCHASE_INVALID_ERROR:
        toast.error('Compra inválida', 'Este producto no está disponible');
        break;
      case Purchases.PURCHASES_ERROR_CODE.NETWORK_ERROR:
        toast.error('Error de red', 'Verifica tu conexión a internet');
        break;
      default:
        toast.error('Error en la compra', error.message);
    }

    console.error('Purchase error:', error);
    return false;
  }
}

// Uso en componente
async function handlePurchase(pkg: PurchasesPackage) {
  setLoading(true);
  const success = await purchasePackage(pkg);
  setLoading(false);

  if (success) {
    // Actualizar UI, sincronizar con Supabase, etc.
    await syncBoostWithSupabase();
    router.back();
  }
}
```

### 2. Comprar con Promoción (Intro Offer)
```typescript
// ✅ CORRECTO: Mostrar precio de introducción si existe
export function PackageCard({ package: pkg }: PackageCardProps) {
  const introPrice = pkg.product.introPrice;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{getPackageTitle(pkg.identifier)}</Text>

      {introPrice && (
        <View style={styles.introOffer}>
          <Text style={styles.introPrice}>{introPrice.priceString}</Text>
          <Text style={styles.introPeriod}>
            por {introPrice.periodNumberOfUnits} {introPrice.periodUnit}
          </Text>
        </View>
      )}

      <Text style={styles.price}>{pkg.product.priceString}</Text>
    </View>
  );
}
```

---

## Verificar Estado de Suscripción

### 1. Check si Usuario es Premium
```typescript
// ✅ CORRECTO: Verificar entitlements
import Purchases from 'react-native-purchases';

async function isPremiumUser(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['premium'] !== undefined;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
}

// Hook personalizado para suscripciones
export function usePremiumStatus() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      setLoading(true);
      const premium = await isPremiumUser();
      setIsPremium(premium);
      setLoading(false);
    }

    checkStatus();

    // Listener para cambios en el estado de compra
    Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      const premium = customerInfo.entitlements.active['premium'] !== undefined;
      setIsPremium(premium);
    });
  }, []);

  return { isPremium, loading };
}

// Uso en componente
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

### 2. Obtener Información de Suscripción
```typescript
// ✅ CORRECTO: Obtener detalles de la suscripción activa
async function getSubscriptionInfo() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active['premium'];

    if (entitlement) {
      return {
        productIdentifier: entitlement.productIdentifier,
        expirationDate: entitlement.expirationDate,
        willRenew: entitlement.willRenew,
        periodType: entitlement.periodType,
        store: entitlement.store,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching subscription info:', error);
    return null;
  }
}

// Mostrar en pantalla de perfil
export function SubscriptionStatus() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    async function loadInfo() {
      const data = await getSubscriptionInfo();
      setInfo(data);
    }
    loadInfo();
  }, []);

  if (!info) return <Text>No tienes una suscripción activa</Text>;

  return (
    <View>
      <Text>Plan: {info.productIdentifier}</Text>
      <Text>
        Expira: {new Date(info.expirationDate).toLocaleDateString()}
      </Text>
      <Text>
        Se renovará: {info.willRenew ? 'Sí' : 'No'}
      </Text>
    </View>
  );
}
```

---

## Restore Purchases

### 1. Restaurar Compras
```typescript
// ✅ CORRECTO: Restaurar compras con feedback
async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();

    if (customerInfo.entitlements.active['premium']) {
      toast.success('Compras restauradas', 'Tu suscripción está activa');
      return true;
    } else {
      toast.info('Sin compras previas', 'No se encontraron compras para restaurar');
      return false;
    }
  } catch (error) {
    console.error('Error restoring purchases:', error);
    toast.error('Error al restaurar', 'No se pudieron restaurar tus compras');
    return false;
  }
}

// Botón de restaurar en pantalla de boost
export function RestorePurchasesButton() {
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    await restorePurchases();
    setLoading(false);
  }

  return (
    <TouchableOpacity onPress={handleRestore} disabled={loading}>
      <Text style={styles.restoreText}>
        {loading ? 'Restaurando...' : 'Restaurar Compras'}
      </Text>
    </TouchableOpacity>
  );
}
```

---

## Sincronización con Supabase

### 1. Guardar Boost en Supabase después de Compra
```typescript
// ✅ CORRECTO: Sincronizar boost con backend
async function syncBoostWithSupabase(
  barId: string,
  productIdentifier: string
): Promise<void> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active['premium'];

    if (!entitlement) {
      throw new Error('No active entitlement found');
    }

    // Calcular duración basada en el producto
    const durationDays = productIdentifier.includes('monthly')
      ? 30
      : productIdentifier.includes('three_month')
      ? 90
      : 180;

    const endAt = new Date();
    endAt.setDate(endAt.getDate() + durationDays);

    // Guardar en Supabase
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

    console.log('Boost synced with Supabase:', data);
  } catch (error) {
    console.error('Error syncing boost with Supabase:', error);
    throw error;
  }
}

// Uso después de compra exitosa
async function handlePurchase(pkg: PurchasesPackage, barId: string) {
  setLoading(true);

  const success = await purchasePackage(pkg);

  if (success) {
    // Sincronizar con Supabase
    await syncBoostWithSupabase(barId, pkg.product.identifier);

    toast.success('¡Boost activado!', 'Tu bar ahora aparece destacado');
    router.back();
  }

  setLoading(false);
}
```

### 2. Verificar Boost Activo desde Supabase
```typescript
// ✅ CORRECTO: Verificar si un bar tiene boost activo
async function hasActiveBoost(barId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('bar_boosts')
      .select('id, status, end_at')
      .eq('bar_id', barId)
      .eq('status', 'active')
      .gte('end_at', new Date().toISOString())
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw error;
    }

    return data !== null;
  } catch (error) {
    console.error('Error checking boost status:', error);
    return false;
  }
}
```

---

## Manejo de Webhooks (Backend)

### 1. Configurar Webhook en RevenueCat Dashboard
```
RevenueCat Dashboard → Project → Integrations → Webhooks

URL: https://tu-proyecto.supabase.co/functions/v1/revenuecat-webhook
Authorization Header: Bearer tu-secret-key
Events:
  ✅ Initial Purchase
  ✅ Renewal
  ✅ Cancellation
  ✅ Expiration
```

### 2. Edge Function en Supabase
```typescript
// supabase/functions/revenuecat-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const payload = await req.json();
    const event = payload.event;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        // Activar o renovar boost
        await supabase
          .from('bar_boosts')
          .update({ status: 'active' })
          .eq('revenuecat_transaction_id', event.original_transaction_id);
        break;

      case 'CANCELLATION':
      case 'EXPIRATION':
        // Desactivar boost
        await supabase
          .from('bar_boosts')
          .update({ status: 'expired' })
          .eq('revenuecat_transaction_id', event.original_transaction_id);
        break;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

---

## Testing

### 1. Sandbox Testing (iOS)
```typescript
// ✅ CORRECTO: Configurar para testing
import Purchases from 'react-native-purchases';

// En desarrollo, usar sandbox
if (__DEV__) {
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);

  // Para iOS, configurar sandbox
  // No hace falta configurar nada especial, solo usar cuentas de sandbox
}

// Crear cuenta de sandbox en App Store Connect
// Settings → Users and Access → Sandbox Testers
```

### 2. Test Cards (Android)
```
Google Play Console → Testing → License Testing

Añadir emails de prueba:
- test@example.com

Usar tarjetas de prueba:
- 4242 4242 4242 4242
```

---

## Checklist de Implementación

### Setup Inicial
- [ ] RevenueCat cuenta creada
- [ ] Proyecto configurado en RevenueCat
- [ ] API Keys (iOS y Android) obtenidas
- [ ] Plugin instalado en app.json
- [ ] Inicialización en _layout.tsx

### Productos
- [ ] Productos creados en App Store Connect / Google Play Console
- [ ] Productos importados a RevenueCat
- [ ] Offerings configuradas
- [ ] Entitlements definidos

### Código
- [ ] Login/Logout con RevenueCat
- [ ] Obtener offerings
- [ ] Realizar compras
- [ ] Verificar entitlements
- [ ] Restore purchases
- [ ] Sincronización con Supabase
- [ ] Manejo de errores completo

### Backend
- [ ] Tabla bar_boosts en Supabase
- [ ] Edge Function para webhooks
- [ ] Webhooks configurados en RevenueCat
- [ ] Políticas RLS configuradas

### Testing
- [ ] Sandbox testers configurados
- [ ] Compras probadas en sandbox
- [ ] Restore purchases probado
- [ ] Webhooks probados
- [ ] Sincronización Supabase probada
