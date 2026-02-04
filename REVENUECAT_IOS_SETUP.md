# 🍎 REVENUECAT + iOS IN-APP PURCHASES - SETUP COMPLETO

**Fecha**: 4 de Febrero de 2026  
**App**: MatchMap  
**Bundle ID**: `com.tuorg.matchmap`

---

## 📋 RESUMEN EJECUTIVO

Este documento te guía paso a paso para configurar RevenueCat con productos de iOS (In-App Purchases) en App Store Connect.

**Productos definidos en el código**:
- ✅ Actualmente solo `lifetime` está en el código
- 🔄 Necesitas añadir: `boost_7d`, `boost_1m`, `boost_1y`

**Entitlement**:
- `boost_active` - Habilita funciones de Boost en la app

---

## 🎯 PASO 1: OBTENER API KEY DE IOS EN REVENUECAT

### 1.1 Acceder a RevenueCat Dashboard
1. Ve a: https://app.revenuecat.com/login
2. Login con tu cuenta
3. Selecciona tu proyecto **"MatchMap"**

### 1.2 Obtener la API Key de iOS
1. En el sidebar izquierdo, click en **"API Keys"**
2. Verás 3 keys:
   - **Public SDK Key (iOS)** - ✅ Esta es la que necesitas
   - Public SDK Key (Android)
   - Secret Key (backend)

3. **Copia la key de iOS**:
   - Formato: `appl_XXXXXXXXXXXXXXXXXXXX`
   - Ejemplo: `appl_aBcDeFgHiJkLmNoPqRsTuV`

### 1.3 Configurar la Key en EAS
**Opción A: Hardcodear en eas.json (NO recomendado para producción real)**

Edita `/eas.json` líneas 72 y 85:
```json
{
  "production": {
    "env": {
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_TU_KEY_AQUI"  // ← Línea 72
    }
  },
  "production-ios": {
    "env": {
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_TU_KEY_AQUI"  // ← Línea 85
    }
  }
}
```

**Opción B: Usar EAS Secrets (Recomendado para producción)**

```bash
# 1. Configurar secret en EAS
eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_TU_KEY_AQUI --type string

# 2. En eas.json, dejar así (EAS inyectará automáticamente):
{
  "production-ios": {
    "env": {
      "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_YOUR_IOS_API_KEY_HERE"  // ← EAS lo reemplazará
    }
  }
}
```

**Verificación**:
```typescript
// El código en utils/revenuecat.ts ya está preparado:
const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'test_sMBliApmNvBxEUAAIamKYkUFExu',
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || 'goog_HcNKJszQnkNPgLUjQv0qgKsXjqj',
});
```

---

## 🛍️ PASO 2: CREAR PRODUCTOS EN APP STORE CONNECT

### 2.1 Acceder a App Store Connect
1. Ve a: https://appstoreconnect.apple.com/
2. Login con tu Apple ID (debe ser parte de tu Apple Developer Team)
3. Click en **"My Apps"**
4. Selecciona tu app **"MatchMap"** (si no existe, créala primero - ver `APP_STORE_CONNECT_SETUP.md`)

### 2.2 Navegar a In-App Purchases
1. En el sidebar izquierdo, click en **"Funciones"** (o **"Features"**)
2. Click en **"Compras integradas"** (o **"In-App Purchases"**)
3. Click en el botón **"+"** (arriba a la izquierda)

### 2.3 Crear los 4 Productos

#### Producto 1: Lifetime Access
1. **Tipo**: Selecciona **"No-Consumible"** (Non-Consumable)
2. Click **"Crear"**
3. Rellenar:
   - **Referencia**: `matchmap_lifetime`
   - **ID de producto**: `lifetime` ⚠️ **CRÍTICO**: Debe coincidir exactamente con el código
   - **Nombre**: `MatchMap Lifetime Access`
   - **Precio**: Selecciona **Tier 50** (~€49.99) o el que prefieras
4. **Revisar metadatos**:
   - **Nombre para mostrar**: `Acceso de por vida` (o en inglés: `Lifetime Access`)
   - **Descripción**: `Desbloquea todas las funciones de MatchMap de por vida sin suscripción.`
   - **Captura de revisión** (opcional): Sube una captura del paywall o de la función
5. Click **"Guardar"**

#### Producto 2: Boost 7 Días
1. **Tipo**: **"Consumible"** (Consumable) - ⚠️ Importante: el usuario puede comprarlo múltiples veces
2. Click **"Crear"**
3. Rellenar:
   - **Referencia**: `matchmap_boost_7d`
   - **ID de producto**: `boost_7d` ⚠️ **CRÍTICO**
   - **Nombre**: `Boost 7 Días`
   - **Precio**: **Tier 5** (~€4.99)
4. **Metadatos**:
   - **Nombre para mostrar**: `Boost 7 Días`
   - **Descripción**: `Aumenta la visibilidad de tu bar durante 7 días en búsquedas y mapa.`
5. Click **"Guardar"**

#### Producto 3: Boost 1 Mes
1. **Tipo**: **"Consumible"**
2. Rellenar:
   - **Referencia**: `matchmap_boost_1m`
   - **ID de producto**: `boost_1m` ⚠️ **CRÍTICO**
   - **Nombre**: `Boost 1 Mes`
   - **Precio**: **Tier 15** (~€14.99)
3. **Metadatos**:
   - **Nombre para mostrar**: `Boost 1 Mes`
   - **Descripción**: `Aumenta la visibilidad de tu bar durante 1 mes. Mejor valor.`
4. Click **"Guardar"**

#### Producto 4: Boost 1 Año
1. **Tipo**: **"Consumible"**
2. Rellenar:
   - **Referencia**: `matchmap_boost_1y`
   - **ID de producto**: `boost_1y` ⚠️ **CRÍTICO**
   - **Nombre**: `Boost 1 Año`
   - **Precio**: **Tier 100** (~€99.99)
3. **Metadatos**:
   - **Nombre para mostrar**: `Boost 1 Año`
   - **Descripción**: `Aumenta la visibilidad de tu bar durante 1 año completo. Máximo ahorro.`
4. Click **"Guardar"**

### 2.4 ⚠️ IMPORTANTE: Aprobar Productos
- Los productos deben estar en estado **"Listo para enviar"** (Ready to Submit)
- Se aprobarán automáticamente cuando subas la primera build a TestFlight
- NO necesitas esperar aprobación para testear con Sandbox

---

## 🎁 PASO 3: CONFIGURAR REVENUECAT

### 3.1 Conectar App Store Connect con RevenueCat
1. Ve a RevenueCat Dashboard → **MatchMap**
2. Click en **"Configuración"** (o **"Settings"**)
3. Click en **"Apple App Store"**
4. **Conectar App Store Connect**:
   - Opción A: Usar App Store Connect API (recomendado)
   - Opción B: Cargar certificado manualmente
   
**Opción A (recomendada)**:
1. Ve a App Store Connect → Users and Access → Keys (API)
2. Genera una nueva key con permisos de "App Manager"
3. Descarga la key (solo se puede hacer 1 vez)
4. En RevenueCat, sube la key + Issuer ID + Key ID
5. Click **"Conectar"**

### 3.2 Añadir Productos en RevenueCat
1. En RevenueCat, ve a **"Products"**
2. Click **"+ Add Product"**
3. **Selecciona "Apple App Store"**
4. Rellena cada producto:

| Product ID (App Store) | RevenueCat Name | Type | Duration |
|------------------------|-----------------|------|----------|
| `lifetime` | Lifetime Access | Non-Consumable | - |
| `boost_7d` | Boost 7 Days | Consumable | - |
| `boost_1m` | Boost 1 Month | Consumable | - |
| `boost_1y` | Boost 1 Year | Consumable | - |

5. Click **"Save"** para cada uno

### 3.3 Crear Entitlement: `boost_active`
1. En RevenueCat, ve a **"Entitlements"**
2. Click **"+ New"**
3. **Identifier**: `boost_active` ⚠️ **CRÍTICO**: debe coincidir con el código
4. **Name**: `Boost Active`
5. **Description**: `User has an active boost for their bar`
6. Click **"Save"**

### 3.4 Asociar Productos al Entitlement
1. En **"Entitlements"**, selecciona `boost_active`
2. Click **"Attach Products"**
3. Selecciona:
   - ✅ `boost_7d`
   - ✅ `boost_1m`
   - ✅ `boost_1y`
   - ❌ `lifetime` (NO - este es para acceso completo, no solo boost)
4. Click **"Save"**

**Nota**: Si quieres que `lifetime` también active boost:
- Crea entitlement `premium_access`
- Asigna `lifetime` a `premium_access`
- En el código, verifica ambos entitlements

### 3.5 Crear Offering: `default`
1. En RevenueCat, ve a **"Offerings"**
2. Click **"+ New Offering"**
3. **Identifier**: `default` ⚠️ **CRÍTICO**
4. **Name**: `Default Offering`
5. **Description**: `Main offering shown to users`
6. Click **"Save"**

### 3.6 Añadir Packages al Offering
1. En el offering `default`, click **"+ Add Package"**
2. Crea 4 packages:

#### Package 1: Lifetime
- **Identifier**: `lifetime_package`
- **Product**: `lifetime`
- **Package Type**: `Lifetime`
- Click **"Save"**

#### Package 2: Boost 7 Days
- **Identifier**: `boost_7d_package`
- **Product**: `boost_7d`
- **Package Type**: `Custom`
- Click **"Save"**

#### Package 3: Boost 1 Month
- **Identifier**: `boost_1m_package`
- **Product**: `boost_1m`
- **Package Type**: `Custom`
- Click **"Save"**

#### Package 4: Boost 1 Year
- **Identifier**: `boost_1y_package`
- **Product**: `boost_1y`
- **Package Type**: `Custom`
- Click **"Save"**

### 3.7 Activar el Offering
1. En el offering `default`, asegúrate de que esté marcado como **"Current"**
2. Si no lo está, click **"Make Current"**

---

## 🧪 PASO 4: TESTEAR CON SANDBOX

### 4.1 Crear Sandbox Tester
1. Ve a App Store Connect → **Users and Access**
2. Click **"Sandbox Testers"**
3. Click **"+"**
4. Rellena:
   - Email: `test.matchmap@icloud.com` (o el que prefieras)
   - Password: elige uno seguro
   - País: España (o el tuyo)
5. Click **"Invite"**
6. **Verifica el email** (revisa spam)

### 4.2 Configurar Device para Sandbox
En tu iPhone/iPad de testing:
1. **Settings** → **App Store**
2. Scroll down hasta **"Sandbox Account"**
3. **Sign Out** (si hay alguna cuenta)
4. **Sign In** con la cuenta sandbox que creaste

### 4.3 Testear Compras
1. Instala la app desde TestFlight
2. Navega al paywall de Boost
3. Selecciona un producto (ej: Boost 7 Días)
4. Click **"Comprar"**
5. Usa la cuenta sandbox cuando te lo pida
6. ✅ La compra debe completarse sin cobro real
7. ✅ El entitlement `boost_active` debe activarse

**Verificar en RevenueCat**:
1. Ve a RevenueCat Dashboard → **Customers**
2. Busca por el email sandbox
3. Verifica que aparece la compra
4. Verifica que `boost_active` está activo

---

## ✅ PASO 5: VERIFICAR CÓDIGO

### 5.1 Productos en el Código
**Actualizar** `/utils/revenuecat.ts`:

```typescript
// Product identifiers - ⚠️ ACTUALIZAR ESTO
export const PRODUCT_IDS = {
  LIFETIME: 'lifetime',
  BOOST_7D: 'boost_7d',      // ← AÑADIR
  BOOST_1M: 'boost_1m',      // ← AÑADIR
  BOOST_1Y: 'boost_1y',      // ← AÑADIR
} as const;
```

### 5.2 Verificar Offering
El código ya obtiene el offering correctamente:

```typescript
export async function getOfferings(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;  // ✅ Usa offering "default"
    }
    console.warn('⚠️ No current offering available');
    return null;
  } catch (error) {
    console.error('❌ Failed to get offerings:', error);
    return null;
  }
}
```

### 5.3 Verificar Entitlement Check
El código ya verifica `boost_active`:

```typescript
export async function hasActiveBoost(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENTS.BOOST_ACTIVE];
    return entitlement !== undefined;  // ✅ Correcto
  } catch (error) {
    console.error('❌ Failed to check boost entitlement:', error);
    return false;
  }
}
```

---

## 📊 RESUMEN DE IDS CRÍTICOS

| Concepto | ID/Valor | Ubicación | Estado |
|----------|----------|-----------|--------|
| **Bundle ID** | `com.tuorg.matchmap` | app.json | ✅ Fijo |
| **RevenueCat iOS Key** | `appl_XXXXX` | eas.json | ⚠️ Pendiente |
| **Entitlement** | `boost_active` | RevenueCat + código | ✅ Definido |
| **Offering** | `default` | RevenueCat | ⚠️ Crear |
| **Producto 1** | `lifetime` | App Store Connect + RevenueCat | ⚠️ Crear |
| **Producto 2** | `boost_7d` | App Store Connect + RevenueCat | ⚠️ Crear |
| **Producto 3** | `boost_1m` | App Store Connect + RevenueCat | ⚠️ Crear |
| **Producto 4** | `boost_1y` | App Store Connect + RevenueCat | ⚠️ Crear |

---

## 🚨 ERRORES COMUNES

### Error: "No products available"
**Causa**: Productos no conectados o offering no configurado  
**Solución**: Verifica Paso 3.2 y 3.6

### Error: "Invalid product identifier"
**Causa**: ID en App Store Connect ≠ ID en el código  
**Solución**: Los IDs deben coincidir EXACTAMENTE:
- App Store Connect: `boost_7d`
- RevenueCat Product: `boost_7d`
- Código: `PRODUCT_IDS.BOOST_7D = 'boost_7d'`

### Error: "Entitlement not found"
**Causa**: Entitlement no creado o mal escrito  
**Solución**: Verifica que sea `boost_active` (exacto, minúsculas, guión bajo)

### Error: "Sandbox purchases not working"
**Causa**: No estás usando sandbox tester  
**Solución**: Settings → App Store → Sandbox Account (sign in)

---

## ✅ CHECKLIST FINAL

Antes de hacer el build de producción:

- [ ] **API Key de iOS** añadida en `eas.json` (o EAS secrets)
- [ ] **4 productos** creados en App Store Connect
- [ ] **4 productos** añadidos en RevenueCat
- [ ] **Entitlement** `boost_active` creado
- [ ] **Productos** asociados al entitlement
- [ ] **Offering** `default` creado con 4 packages
- [ ] **Offering** marcado como "Current"
- [ ] **Código** actualizado con `PRODUCT_IDS` completo
- [ ] **Sandbox tester** creado y testeado
- [ ] **Compra test** completada exitosamente

---

## 📚 RECURSOS

- **RevenueCat Docs**: https://www.revenuecat.com/docs/getting-started
- **App Store Connect**: https://appstoreconnect.apple.com/
- **Sandbox Testing**: https://www.revenuecat.com/docs/test-and-launch/sandbox
- **iOS IAP Guide**: https://developer.apple.com/in-app-purchase/

---

**¡Todo listo para configurar RevenueCat + iOS IAP! 🎉**
