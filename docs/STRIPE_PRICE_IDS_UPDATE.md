# 🔄 Actualización de IDs de Precios de Stripe

## 📋 Resumen de Cambios

Se han actualizado los IDs de precios de Stripe tanto en el **webhook** como en el **frontend** para que coincidan con los IDs reales de tu cuenta de Stripe.

## 🔑 Nuevos IDs de Precios

### **Antes (IDs obsoletos):**
```typescript
// ❌ IDs obsoletos que causaban errores
'price_1RrMjG7hGI6XwPtaHSZRXojJ': 'pro_monthly',
'price_1RsRv77hGI6XwPtaGCjuajUx': 'pro_yearly',
'price_1RrMjc7hGI6XwPtaCrf05aoZ': 'elite_monthly',
'price_1RsRvc7hGI6XwPtaWvHMQD6K': 'elite_yearly'
```

### **Después (IDs actualizados):**
```typescript
// ✅ Nuevos IDs reales de Stripe
'price_1RvGlr7hGI6XwPtaE9d03BfI': 'pro_monthly',
'price_1RvGlr7hGI6XwPta032XCAwP': 'pro_yearly',
'price_1RvGmN7hGI6XwPtaye2UkCso': 'elite_monthly',
'price_1RvGmN7hGI6XwPta96F6JX70': 'elite_yearly'
```

## 📁 Archivos Actualizados

### 1. **Webhook** (`supabase/functions/stripe-webhook/index.ts`)
```typescript
function getPlanType(priceId: string): string {
  // ✅ ACTUALIZADO: Nuevos IDs de precios de Stripe
  const planMap: Record<string, string> = {
    'price_1RvGlr7hGI6XwPtaE9d03BfI': 'pro_monthly',
    'price_1RvGlr7hGI6XwPta032XCAwP': 'pro_yearly',
    'price_1RvGmN7hGI6XwPtaye2UkCso': 'elite_monthly',
    'price_1RvGmN7hGI6XwPta96F6JX70': 'elite_yearly'
  };
  
  const planType = planMap[priceId];
  if (!planType) {
    console.error("❌ No matching planType found for priceId:", priceId);
    return "invalid";
  }
  
  return planType;
}
```

### 2. **Utilidades** (`utils/subscription.ts`)
```typescript
export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  pro_monthly: {
    id: 'price_1RvGlr7hGI6XwPtaE9d03BfI', // ✅ ACTUALIZADO
    name: 'Pro Bar - Mensual',
    // ... resto de configuración
  },
  pro_yearly: {
    id: 'price_1RvGlr7hGI6XwPta032XCAwP', // ✅ ACTUALIZADO
    name: 'Pro Bar - Anual',
    // ... resto de configuración
  },
  elite_monthly: {
    id: 'price_1RvGmN7hGI6XwPtaye2UkCso', // ✅ ACTUALIZADO
    name: 'Elite Bar - Mensual',
    // ... resto de configuración
  },
  elite_yearly: {
    id: 'price_1RvGmN7hGI6XwPta96F6JX70', // ✅ ACTUALIZADO
    name: 'Elite Bar - Anual',
    // ... resto de configuración
  }
};
```

### 3. **Pantalla de Planes** (`app/subscription-plans.tsx`)
```typescript
const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  pro_monthly: {
    id: 'price_1RvGlr7hGI6XwPtaE9d03BfI', // ✅ ACTUALIZADO
    // ... resto de configuración
  },
  // ... otros planes
};
```

## 🧪 Verificación de la Actualización

### **1. Test del Webhook**
```bash
# Con Stripe CLI
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Simular checkout con nuevo price_id
stripe trigger checkout.session.completed \
  --add checkout_session:data.object.items.data.0.price.id=price_1RvGlr7hGI6XwPtaE9d03BfI
```

**Log esperado:**
```
📨 Processing Stripe event: checkout.session.completed
🛒 Processing checkout session: cs_xxx
👤 User: user_123, Bar: bar_456
✅ Subscription inserted successfully
✅ User status updated to: active
```

### **2. Test del Frontend**
```typescript
// En subscription-plans.tsx, verificar que se envía el ID correcto
console.log('🛒 Starting subscription for plan:', plan.name);
console.log('👤 User:', user.id);
console.log('🏪 Bar:', barId);
console.log('💰 Price ID:', plan.id); // Debe ser uno de los nuevos IDs
```

### **3. Verificar en Base de Datos**
```sql
-- Verificar que se inserta con plan_type correcto
SELECT 
  stripe_subscription_id,
  plan_type,
  status,
  created_at
FROM subscriptions 
WHERE stripe_subscription_id = 'sub_xxx'
ORDER BY created_at DESC;
```

## 🚨 Problemas Comunes y Soluciones

### **Error: "No matching planType found for priceId"**
**Causa:** El webhook recibe un `price_id` que no está en el mapeo.
**Solución:** Verificar que el `price_id` en Stripe coincida con los IDs del código.

### **Error: "Invalid plan type, cannot insert subscription"**
**Causa:** El `getPlanType()` devuelve "invalid".
**Solución:** Revisar el mapeo en `getPlanType()` y asegurar que todos los IDs estén incluidos.

### **Suscripción no se crea en la base de datos**
**Causa:** Error en la inserción o validación.
**Solución:** Revisar logs del webhook y verificar que `plan_type` no sea "invalid".

## 🔍 Debugging

### **1. Logs del Webhook**
```typescript
// Añadir logs adicionales si es necesario
console.log('🔍 Price ID recibido:', subscription.items.data[0].price.id);
console.log('🔍 Plan type mapeado:', getPlanType(subscription.items.data[0].price.id));
```

### **2. Verificar en Stripe Dashboard**
1. Ir a **Products** en Stripe Dashboard
2. Verificar que los **Price IDs** coincidan con los del código
3. Confirmar que los precios estén **activos**

### **3. Test de Mapeo**
```typescript
// Test local de la función getPlanType
const testIds = [
  'price_1RvGlr7hGI6XwPtaE9d03BfI',
  'price_1RvGlr7hGI6XwPta032XCAwP',
  'price_1RvGmN7hGI6XwPtaye2UkCso',
  'price_1RvGmN7hGI6XwPta96F6JX70'
];

testIds.forEach(id => {
  console.log(`${id} -> ${getPlanType(id)}`);
});
```

## ✅ Checklist de Verificación

- [ ] **Webhook actualizado** con nuevos IDs
- [ ] **Frontend actualizado** con nuevos IDs
- [ ] **IDs verificados** en Stripe Dashboard
- [ ] **Test de webhook** exitoso
- [ ] **Test de frontend** exitoso
- [ ] **Base de datos** recibe suscripciones correctamente
- [ ] **Logs limpios** sin errores de mapeo

## 🚀 Próximos Pasos

1. **Deploy** del webhook actualizado
2. **Test completo** del flujo de suscripción
3. **Monitoreo** de logs para confirmar funcionamiento
4. **Documentación** de cualquier cambio adicional

## 📞 Soporte

Si encuentras problemas después de la actualización:

1. **Revisar logs** del webhook
2. **Verificar IDs** en Stripe Dashboard
3. **Testear** con Stripe CLI
4. **Comparar** con la documentación original

---

**Nota:** Los IDs de precios son únicos por cuenta de Stripe. Si cambias de cuenta o entorno, necesitarás actualizar estos IDs nuevamente. 