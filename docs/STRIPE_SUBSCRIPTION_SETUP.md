# Stripe Subscription Setup for MatchMap

## ✅ PASO 1: Productos y Precios en Stripe

Los siguientes productos y precios ya están creados en tu cuenta de Stripe:

| Producto  | Tipo    | Precio   | Ciclo   | Product ID | Price ID |
| --------- | ------- | -------- | ------- | ---------- | -------- |
| Pro Bar   | Mensual | 9,99 €   | Mensual | prod_SmwcJf4Ku56fCv | price_1RrMjG7hGI6XwPtaHSZRXojJ |
| Pro Bar   | Anual   | 79,99 €  | Anual   | prod_So43iZXbUoGvL2 | price_1RsRv77hGI6XwPtaGCjuajUx |
| Elite Bar | Mensual | 19,99 €  | Mensual | prod_Smwc5sRCQjtyWV | price_1RrMjc7hGI6XwPtaCrf05aoZ |
| Elite Bar | Anual   | 149,99 € | Anual   | prod_So43qYDxb24Ftg | price_1RsRvc7hGI6XwPtaWvHMQD6K |

## ✅ PASO 2: Configuración de Supabase

### Variables de Entorno

Añade estas variables a tu proyecto de Supabase:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_51RrEDR7hGI6XwPtaKlOjmUEMS6MeF1qYfnk6jiEfJWg9FrgsawcqGPOVeI4OOHBIEJhc2F8TXnIMWWGUdAnlpcbq00oW1gZkv1
STRIPE_WEBHOOK_SECRET=whsec_... # Obtener desde Stripe Dashboard

# Supabase Keys (ya configuradas)
SUPABASE_URL=tu_url_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

### Base de Datos

Ejecuta la migración SQL para crear las tablas necesarias:

```sql
-- Ejecutar en Supabase SQL Editor
-- Ver archivo: migrations/create_subscription_tables.sql
```

## ✅ PASO 3: Edge Functions

### Deploy de las Edge Functions

1. **create-checkout-session**
```bash
supabase functions deploy create-checkout-session
```

2. **stripe-webhook**
```bash
supabase functions deploy stripe-webhook
```

### Configurar Webhook en Stripe

1. Ve a tu Stripe Dashboard
2. Navega a Developers > Webhooks
3. Crea un nuevo endpoint:
   - URL: `https://tu-proyecto.supabase.co/functions/v1/stripe-webhook`
   - Eventos a escuchar:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

## ✅ PASO 4: Configuración de la App

### Variables de Entorno en React Native

Añade estas variables a tu archivo `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

### Deep Linking

Configura los deep links en `app.json`:

```json
{
  "expo": {
    "scheme": "matchmap",
    "ios": {
      "bundleIdentifier": "com.tuapp.matchmap"
    },
    "android": {
      "package": "com.tuapp.matchmap"
    }
  }
}
```

## ✅ PASO 5: Funcionalidades Implementadas

### Pantallas Creadas

1. **Subscription Plans Screen** (`/subscription-plans`)
   - Muestra todos los planes disponibles
   - Integración con Stripe Checkout
   - UI moderna y responsive

2. **Success Screen** (`/subscription-success`)
   - Confirmación de pago exitoso
   - Auto-navegación al perfil

3. **Cancel Screen** (`/subscription-cancel`)
   - Manejo de cancelación de pago
   - Opción de reintentar

### Componentes

1. **SubscriptionStatus** (`components/SubscriptionStatus.tsx`)
   - Muestra el estado actual de la suscripción
   - Botón de actualización
   - Lista de funciones incluidas

2. **useSubscription Hook** (`hooks/useSubscription.ts`)
   - Hook personalizado para manejar suscripciones
   - Validación de funciones premium
   - Límites de fotos por plan

### Integración en Perfil

El componente `SubscriptionStatus` se ha integrado en la pantalla de perfil para mostrar el estado de la suscripción del usuario.

## ✅ PASO 6: Pruebas

### Tarjetas de Prueba

Usa estas tarjetas para probar los pagos:

- **Éxito**: `4242 4242 4242 4242`
- **Requiere autenticación**: `4000 0025 0000 3155`
- **Pago rechazado**: `4000 0000 0000 0002`

### Flujo de Prueba

1. Ve a la pantalla de perfil
2. Toca "Ver Planes" o "Actualizar"
3. Selecciona un plan
4. Completa el pago con tarjeta de prueba
5. Verifica que aparezca en el perfil
6. Comprueba que las funciones premium estén disponibles

## ✅ PASO 7: Funciones Premium

### Límites por Plan

| Plan | Fotos Máximas | Marca de Agua | Estadísticas | Soporte |
|------|---------------|---------------|--------------|---------|
| Gratuito | 3 | Sí | Básicas | Email |
| Pro | 10 | No | Básicas | Prioritario |
| Elite | 50 | No | Avanzadas | VIP 24/7 |

### Validación en Código

```typescript
// Ejemplo de uso del hook
const { 
  hasActiveSubscription, 
  isPro, 
  isElite, 
  canUploadMorePhotos,
  maxPhotosAllowed 
} = useSubscription(barId);

// Verificar si puede subir más fotos
if (canUploadMorePhotos(currentPhotoCount)) {
  // Permitir subir foto
} else {
  // Mostrar prompt de actualización
}
```

## ✅ PASO 8: Monitoreo

### Logs de Supabase

Revisa los logs de las Edge Functions en Supabase Dashboard:
- Functions > create-checkout-session
- Functions > stripe-webhook

### Stripe Dashboard

Monitorea los pagos y suscripciones en:
- Payments > Payments
- Customers > Customers
- Billing > Subscriptions

## 🔧 Solución de Problemas

### Error: "No se pudo crear la sesión de pago"
- Verifica que las variables de entorno estén configuradas
- Comprueba que la Edge Function esté desplegada
- Revisa los logs de Supabase

### Error: "Webhook signature verification failed"
- Verifica que el webhook secret esté correcto
- Asegúrate de que la URL del webhook sea la correcta

### Suscripción no aparece en la app
- Verifica que el webhook esté configurado correctamente
- Revisa los logs de la Edge Function stripe-webhook
- Comprueba que la tabla `subscriptions` tenga los datos correctos

## 📱 Próximos Pasos

1. **Implementar cancelación de suscripciones**
2. **Añadir gestión de facturas**
3. **Implementar cupones de descuento**
4. **Añadir analytics de conversión**
5. **Implementar notificaciones push para renovaciones**

## 🔐 Seguridad

- Todas las claves de Stripe están en variables de entorno
- RLS (Row Level Security) habilitado en todas las tablas
- Webhook signature verification implementado
- Validación de permisos en el frontend y backend 