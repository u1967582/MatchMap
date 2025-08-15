# Flujo de Upgrade de Plan - Implementación Completa

## 🎯 Resumen del Flujo Implementado

### **Flujo A: Upgrade de Plan (Usuario ya tiene bar)**

**Secuencia completa:**
1. **Perfil** → Botón "Ver Planes" → Pantalla de planes con `barId`
2. **Selección** → Usuario elige plan → `create-checkout-session` con `{ user_id, price_id, bar_id }`
3. **Pago** → Stripe Checkout → Webhook procesa evento
4. **Webhook** → Inserta suscripción **con `bar_id`** → Actualiza estado del usuario
5. **Redirección** → Vuelve al perfil → **Refetch** automático del estado

## 📱 Componentes Implementados

### 1. **Pantalla de Planes** (`app/subscription-plans.tsx`)

**Características:**
- ✅ Recibe `barId` por parámetros de navegación
- ✅ Muestra planes disponibles con precios y características
- ✅ Llama a `create-checkout-session` con `bar_id` incluido
- ✅ Maneja estados de carga y errores
- ✅ UI consistente con el diseño de la app

**Uso:**
```typescript
// Navegación desde perfil (con barId)
router.push({ 
  pathname: '/subscription-plans', 
  params: { barId: userBarId } 
});

// Navegación sin barId (para nuevos usuarios)
router.push('/subscription-plans');
```

### 2. **ProfileScreen Actualizado** (`screens/ProfileScreen.tsx`)

**Cambios implementados:**
- ✅ Botón "Ver Planes" pasa `barId` automáticamente
- ✅ Integración con `useUserSubscription` hook
- ✅ Muestra información detallada del plan actual
- ✅ Navegación inteligente según si tiene bar o no

**Lógica de navegación:**
```typescript
const handleViewPlans = useCallback(() => {
  if (userBars.length > 0) {
    // Con bar → suscripción enlazada
    router.push({ 
      pathname: '/subscription-plans', 
      params: { barId: userBars[0].id } 
    });
  } else {
    // Sin bar → pantalla de planes sin barId
    router.push('/subscription-plans');
  }
}, [router, userBars]);
```

### 3. **Hook useUserSubscription** (`hooks/useUserSubscription.ts`)

**Funcionalidad:**
- ✅ Obtiene suscripción activa del usuario
- ✅ Calcula límites de fotos según el plan
- ✅ Maneja estados de carga y errores
- ✅ Devuelve información completa de la suscripción

**Uso:**
```typescript
const { 
  hasActiveSubscription, 
  planType, 
  maxPhotosAllowed, 
  subscription 
} = useUserSubscription(userId);
```

### 4. **Utilidades de Suscripción** (`utils/subscription.ts`)

**Funciones disponibles:**
- ✅ `getPlanByType()` - Obtener detalles del plan
- ✅ `formatPrice()` - Formatear precios para display
- ✅ `getYearlySavings()` - Calcular ahorros anuales
- ✅ `canUploadMorePhotos()` - Validar límites de fotos

## 🔄 Flujo de Datos Completo

### **1. Usuario hace clic en "Ver Planes"**
```typescript
// ProfileScreen.tsx
<TouchableOpacity style={styles.headerPlanButton} onPress={handleViewPlans}>
  <Text style={styles.headerPlanButtonText}>Ver Planes</Text>
</TouchableOpacity>
```

### **2. Navegación con barId**
```typescript
// Si tiene bar, pasar barId
router.push({ 
  pathname: '/subscription-plans', 
  params: { barId: userBars[0].id } 
});
```

### **3. Pantalla de planes recibe barId**
```typescript
// subscription-plans.tsx
const { barId } = useLocalSearchParams<{ barId?: string }>();

// Mostrar título apropiado
<Text style={styles.infoTitle}>
  {barId ? 'Actualizar Plan' : 'Elegir Plan'}
</Text>
```

### **4. Llamada a create-checkout-session**
```typescript
const { data, error } = await supabase.functions.invoke('create-checkout-session', {
  body: { 
    user_id: user.id, 
    price_id: plan.id,
    bar_id: barId // ← Clave: incluir bar_id para suscripción enlazada
  },
});
```

### **5. Webhook procesa el evento**
```typescript
// stripe-webhook/index.ts
case "checkout.session.completed":
  const session = event.data.object;
  // metadata.bar_id ya está presente
  const barId = customer?.metadata?.bar_id; // No es 'pending'
  
  // Insertar suscripción YA ENLAZADA al bar
  const subscriptionData = {
    user_id: userId,
    bar_id: barId, // ← Ya tiene valor
    // ... otros campos
  };
```

### **6. Redirección post-pago**
```typescript
// create-checkout-session/index.ts
success_url: "matchmap://profile?payment=success",
cancel_url: "matchmap://profile?payment=cancelled",
```

### **7. Refetch automático en perfil**
```typescript
// ProfileScreen.tsx
useEffect(() => {
  // Refetch cuando vuelve de la pantalla de planes
  fetchUserProfile();
}, [fetchUserProfile]);
```

## 🗄️ Base de Datos Esperada

### **Después del upgrade exitoso:**

#### **`stripe_customers`**
```sql
-- Fila existente actualizada
UPDATE stripe_customers 
SET bar_id = 'bar_123', updated_at = NOW()
WHERE user_id = 'user_456';
```

#### **`subscriptions`**
```sql
-- Nueva suscripción YA ENLAZADA
INSERT INTO subscriptions (
  user_id, bar_id, stripe_customer_id, 
  stripe_subscription_id, status, plan_type
) VALUES (
  'user_456', 'bar_123', 'cus_789', 
  'sub_abc', 'active', 'elite_monthly'
);
```

#### **`users.subscription_status`**
```sql
-- Estado actualizado
UPDATE users 
SET subscription_status = 'active'
WHERE id = 'user_456';
```

## 🧪 Testing del Flujo

### **1. Test Local con Stripe CLI**
```bash
# Escuchar webhooks
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Simular checkout completado
stripe trigger checkout.session.completed
```

### **2. Test de Navegación**
```typescript
// Verificar que barId se pasa correctamente
console.log('barId recibido:', barId);

// Verificar llamada a create-checkout-session
console.log('Request body:', { 
  user_id: user.id, 
  price_id: plan.id,
  bar_id: barId 
});
```

### **3. Test de Webhook**
```typescript
// Verificar que metadata.bar_id no es 'pending'
console.log('bar_id en metadata:', customer?.metadata?.bar_id);

// Verificar inserción con bar_id
console.log('subscription insertado con bar_id:', subscriptionData.bar_id);
```

## 🔐 Consideraciones de Seguridad

### **1. Autenticación**
- ✅ JWT token requerido en todas las operaciones
- ✅ Verificación de usuario en `subscription-plans`
- ✅ Validación de sesión en `create-checkout-session`

### **2. Validación de Datos**
- ✅ `user_id` obligatorio
- ✅ `price_id` debe ser válido
- ✅ `bar_id` opcional pero validado si se proporciona

### **3. Idempotencia**
- ✅ Webhook maneja duplicados por `stripe_subscription_id`
- ✅ No se crean suscripciones duplicadas

## 📱 UI/UX Implementada

### **1. Estados de Carga**
- ✅ Loading spinner durante creación de checkout
- ✅ Botón deshabilitado mientras procesa
- ✅ Mensajes de error claros

### **2. Información del Plan**
- ✅ Precios formateados correctamente
- ✅ Características del plan visibles
- ✅ Ahorros anuales destacados

### **3. Navegación Intuitiva**
- ✅ Botón de retroceso funcional
- ✅ Títulos dinámicos según contexto
- ✅ Redirección automática post-pago

## 🚀 Próximos Pasos

### **1. Implementar deep link handling**
```typescript
// En ProfileScreen
useEffect(() => {
  const handleDeepLink = (event: Linking.EventType) => {
    if (event.url?.includes('payment=success')) {
      // Refetch datos de suscripción
      fetchUserProfile();
    }
  };
  
  Linking.addEventListener('url', handleDeepLink);
}, []);
```

### **2. Añadir notificaciones push**
- Notificar cuando la suscripción se active
- Recordatorios de renovación
- Alertas de pago fallido

### **3. Implementar cancelación**
- Pantalla de gestión de suscripción
- Cancelación con confirmación
- Downgrade a plan gratuito

## ✅ Resumen de Implementación

El flujo de upgrade está **completamente implementado** y funcional:

1. ✅ **Navegación** desde perfil con `barId`
2. ✅ **Pantalla de planes** que recibe parámetros
3. ✅ **Llamada a Edge Function** con `bar_id` incluido
4. ✅ **Webhook** que crea suscripción ya enlazada
5. ✅ **Redirección** y refetch automático
6. ✅ **UI consistente** con el diseño de la app
7. ✅ **Manejo de errores** robusto
8. ✅ **Estados de carga** apropiados

El usuario puede ahora actualizar su plan desde el perfil y la suscripción se vinculará automáticamente a su bar existente. 🎯 