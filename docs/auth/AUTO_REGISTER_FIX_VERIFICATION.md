# ✅ Fix: Vinculación Auto-Register → Registro Usuario

## 🔧 Cambios Realizados

### 1. **Normalización del Email en Pre-Registro** (`services/bars.ts`)

**Cambio**: El email ahora se guarda siempre en **minúsculas** y sin espacios.

```typescript
// ANTES:
const { data, error } = await supabase
  .from('auto_pre_register_bars')
  .insert({
    ...payload,  // email tal cual viene
    created_by_user_id: user.id,
    status: 'pre_registered',
  })

// DESPUÉS:
const normalizedPayload = {
  ...payload,
  email: payload.email.toLowerCase().trim(),  // ✅ NORMALIZADO
};

console.log(`📧 Saving pre-registered bar with email: ${normalizedPayload.email}`);

const { data, error } = await supabase
  .from('auto_pre_register_bars')
  .insert({
    ...normalizedPayload,
    created_by_user_id: user.id,
    status: 'pre_registered',
  })
```

### 2. **Búsqueda Mejorada en Registro** (`app/(auth)/components/RegisterModal.tsx`)

**Cambios**:
- ✅ Email normalizado a minúsculas
- ✅ Filtro por `converted_bar_id IS NULL` (solo bares no convertidos)
- ✅ Logs detallados para depuración

```typescript
// ANTES:
console.log(`🔍 Checking for pre-registered bar for email: ${userEmail}`);

const { data: preRegBars, error: queryError } = await supabase
  .from('auto_pre_register_bars')
  .select('id')
  .eq('email', userEmail)  // ❌ No normalizado
  .eq('status', 'pre_registered')
  .limit(1);

// DESPUÉS:
const normalizedEmail = userEmail.toLowerCase().trim();  // ✅ NORMALIZADO

console.log(`========================================`);
console.log(`🔍 BUSCANDO BAR PRE-REGISTRADO`);
console.log(`📧 Email original: ${userEmail}`);
console.log(`📧 Email normalizado: ${normalizedEmail}`);

const { data: preRegBars, error: queryError } = await supabase
  .from('auto_pre_register_bars')
  .select('id, email, name, status, converted_bar_id, created_at')
  .eq('email', normalizedEmail)  // ✅ Email normalizado
  .eq('status', 'pre_registered')
  .is('converted_bar_id', null)  // ✅ Solo no convertidos
  .limit(1);
```

### 3. **Logs Mejorados**

Ahora verás logs muy claros en cada paso:

**Al buscar el bar**:
```
========================================
🔍 BUSCANDO BAR PRE-REGISTRADO
========================================
📧 Email original: CiqVzNjHtv@ZuDpCk.com
📧 Email normalizado: ciqvznjhtv@zudpck.com
👤 User ID: abc-123-...
🔎 Query results: { found: 1, data: [...] }
✅ BAR PRE-REGISTRADO ENCONTRADO!
   ID: 277b9202-...
   Nombre: Test Bar
   Email: ciqvznjhtv@zudpck.com
```

**Al llamar a la Edge Function**:
```
🚀 LLAMANDO A EDGE FUNCTION
   URL: https://...supabase.co/functions/v1/promote_pre_registered_bar_with_images
   Payload: { preBarId: "277b9202-...", ownerId: "abc-123-..." }
📤 Enviando petición...
📥 Respuesta recibida - Status: 200 OK
📦 Response body: { success: true, barId: "xyz-789-...", ... }
✅ BAR PROMOVIDO EXITOSAMENTE!
   Bar ID: xyz-789-...
   Imágenes del bar: 3
   Imágenes del menú: 2
```

---

## 🧪 Pasos para Probar

### **Paso 1: Limpia la Base de Datos** (Opcional - solo para empezar limpio)

En Supabase SQL Editor:

```sql
-- Limpia datos de prueba anteriores
DELETE FROM auto_pre_register_bar_images;
DELETE FROM auto_pre_register_bar_menus;
DELETE FROM auto_pre_register_bars WHERE email LIKE '%test%';
```

### **Paso 2: Reinicia la App con Caché Limpio**

```bash
cd /Users/roger.gost/Documents/repos/MatchMap
expo start -c
```

### **Paso 3: Pre-Registra un Bar (Super Usuario)**

1. **Inicia sesión** como super usuario
2. **Haz clic** en "Registrar Bar en Frío"
3. **Completa el formulario**:
   - Nombre: "Test Bar"
   - Email: **`test@example.com`** (usa minúsculas o mayúsculas, funcionará igual)
   - Teléfono: +34 123 456 789
   - Dirección, etc.
4. **Agrega imágenes**:
   - 2-3 fotos del bar
   - 2-3 fotos del menú
5. **Completa el registro**

**Verifica en los logs**:
```
📧 Saving pre-registered bar with email: test@example.com
✅ Bar pre-registrado exitosamente: 277b9202-...
```

### **Paso 4: Verifica en la Base de Datos**

En Supabase SQL Editor:

```sql
-- Verifica que el bar se guardó correctamente
SELECT 
  id,
  name,
  email,
  status,
  converted_bar_id,
  created_at
FROM auto_pre_register_bars
WHERE email = 'test@example.com';

-- Verifica las imágenes
SELECT COUNT(*) as total_images
FROM auto_pre_register_bar_images
WHERE auto_pre_bar_id = '<UUID del paso anterior>';

SELECT COUNT(*) as total_menus
FROM auto_pre_register_bar_menus
WHERE auto_pre_bar_id = '<UUID del paso anterior>';
```

**Resultado esperado**:
- ✅ 1 fila en `auto_pre_register_bars` con `email = 'test@example.com'` (minúsculas)
- ✅ `converted_bar_id = NULL`
- ✅ Imágenes en ambas tablas

### **Paso 5: Registra al Usuario con ese Email**

1. **Cierra sesión** (si estás como super usuario)
2. **Haz clic** en "Registrar"
3. **Completa el formulario**:
   - Email: **`test@example.com`** o **`TEST@EXAMPLE.COM`** o **`TeSt@ExAmPlE.cOm`** (cualquier combinación, funcionará)
   - Username: testuser
   - Nombre: Test User
   - Contraseña: test123
4. **Envía el formulario**

### **Paso 6: Verifica los Logs**

En la consola de Expo/Metro, deberías ver:

```
✅ Usuario registrado: test@example.com

========================================
🔍 BUSCANDO BAR PRE-REGISTRADO
========================================
📧 Email original: TEST@EXAMPLE.COM
📧 Email normalizado: test@example.com
👤 User ID: abc-123-...
🔎 Query results: { found: 1, data: [{ id: "277b9202-...", ... }] }
✅ BAR PRE-REGISTRADO ENCONTRADO!
   ID: 277b9202-9aad-4efe-a057-4c29dea56f5a
   Nombre: Test Bar
   Email: test@example.com
   Creado: 2025-01-15T10:30:00Z

🚀 LLAMANDO A EDGE FUNCTION
   URL: https://hmtfxpihkoisncglllmq.supabase.co/functions/v1/promote_pre_registered_bar_with_images
   Payload: { preBarId: "277b9202-...", ownerId: "abc-123-..." }
📤 Enviando petición...
📥 Respuesta recibida - Status: 200 OK
📦 Response body: { success: true, barId: "xyz-789-...", barImagesCount: 3, menuImagesCount: 2 }
✅ BAR PROMOVIDO EXITOSAMENTE!
   Bar ID: xyz-789-...
   Imágenes del bar: 3
   Imágenes del menú: 2

🎉 PROCESO COMPLETADO
   Total imágenes migradas: 5
========================================
```

### **Paso 7: Verifica en la Base de Datos (Después de Promoción)**

```sql
-- Verifica que el bar fue promovido
SELECT 
  id,
  name,
  email,
  status,
  converted_bar_id,  -- ✅ Debería tener un UUID (el ID del bar real)
  created_at
FROM auto_pre_register_bars
WHERE email = 'test@example.com';

-- Verifica que el bar real existe
SELECT id, name
FROM bars
WHERE id = (
  SELECT converted_bar_id 
  FROM auto_pre_register_bars 
  WHERE email = 'test@example.com'
);

-- Verifica las imágenes del bar
SELECT 
  id,
  bar_id,
  image_url,
  image_order
FROM bar_images
WHERE bar_id = (
  SELECT converted_bar_id 
  FROM auto_pre_register_bars 
  WHERE email = 'test@example.com'
)
ORDER BY image_order;

-- Verifica las imágenes del menú
SELECT 
  id,
  bar_id,
  image_url,
  image_order
FROM bar_menus
WHERE bar_id = (
  SELECT converted_bar_id 
  FROM auto_pre_register_bars 
  WHERE email = 'test@example.com'
)
ORDER BY image_order;
```

**Resultado esperado**:
- ✅ `converted_bar_id` ya NO es NULL (tiene el UUID del bar real)
- ✅ Existe un bar en `bars` con ese ID
- ✅ Hay filas en `bar_images` con `bar_id = <converted_bar_id>`
- ✅ Hay filas en `bar_menus` con `bar_id = <converted_bar_id>`

---

## 🚨 Problemas y Soluciones

### Problema 1: "No pre-registered bar found for this email"

**Causa posible**:
- Email guardado en mayúsculas/minúsculas diferente
- Bar ya fue convertido (`converted_bar_id` no es NULL)

**Solución**:
1. Verifica en la BD:
```sql
SELECT email, converted_bar_id 
FROM auto_pre_register_bars 
WHERE email ILIKE '%test%';
```

2. Si el email está en mayúsculas, el nuevo código lo normalizará en futuros registros.
3. Para datos existentes, normaliza manualmente:
```sql
UPDATE auto_pre_register_bars
SET email = LOWER(email);
```

### Problema 2: Edge Function no se llama

**Causa posible**:
- No hay sesión activa
- URL de la Edge Function incorrecta

**Solución**:
Verifica los logs:
```
❌ No session available for Edge Function call
```

Si ves este mensaje, asegúrate de que el usuario está autenticado antes de llamar a `checkAndPromotePreRegisteredBar`.

### Problema 3: Edge Function retorna error

**Causa posible**:
- El RPC `promote_pre_registered_bar` no existe
- Permisos insuficientes

**Solución**:
Verifica que la Edge Function esté desplegada:
```bash
supabase functions deploy promote_pre_registered_bar_with_images
```

---

## ✅ Checklist de Verificación

- [ ] El código en `services/bars.ts` normaliza el email a minúsculas
- [ ] El código en `RegisterModal.tsx` normaliza el email a minúsculas
- [ ] La búsqueda filtra por `converted_bar_id IS NULL`
- [ ] Los logs muestran "BUSCANDO BAR PRE-REGISTRADO"
- [ ] Los logs muestran "BAR PRE-REGISTRADO ENCONTRADO"
- [ ] Los logs muestran "LLAMANDO A EDGE FUNCTION"
- [ ] Los logs muestran "BAR PROMOVIDO EXITOSAMENTE"
- [ ] El usuario ve el Alert "¡Bar Reclamado!"
- [ ] En la BD, `converted_bar_id` ya no es NULL
- [ ] Existen filas en `bar_images` y `bar_menus`

---

## 📊 Comparación: Antes vs. Después

### ANTES ❌

```
✅ Usuario registrado: ciqvznjhtv@zudpck.com
🔍 Checking for pre-registered bar for email: ciqvznjhtv@zudpck.com
ℹ️ No pre-registered bar found for this email
✅ Registro exitoso
```

**Problema**: El email en la BD estaba como `CiqVzNjHtv@ZuDpCk.com` (mayúsculas) pero se buscaba `ciqvznjhtv@zudpck.com` (minúsculas).

### DESPUÉS ✅

```
✅ Usuario registrado: ciqvznjhtv@zudpck.com

========================================
🔍 BUSCANDO BAR PRE-REGISTRADO
========================================
📧 Email original: CiqVzNjHtv@ZuDpCk.com
📧 Email normalizado: ciqvznjhtv@zudpck.com
👤 User ID: abc-123-...
🔎 Query results: { found: 1, data: [...] }
✅ BAR PRE-REGISTRADO ENCONTRADO!

🚀 LLAMANDO A EDGE FUNCTION
📤 Enviando petición...
📥 Respuesta recibida - Status: 200 OK
✅ BAR PROMOVIDO EXITOSAMENTE!
   Bar ID: xyz-789-...
   Imágenes del bar: 3
   Imágenes del menú: 2

🎉 PROCESO COMPLETADO
========================================
```

**Solución**: Ambos emails se normalizan a minúsculas, coinciden, y el flujo continúa.

---

## 🎯 Resumen

| Archivo | Cambio | Propósito |
|---------|--------|-----------|
| `services/bars.ts` | Normalizar email a minúsculas al guardar | Consistencia en pre-registro |
| `RegisterModal.tsx` | Normalizar email a minúsculas al buscar | Coincidencia garantizada |
| `RegisterModal.tsx` | Filtrar por `converted_bar_id IS NULL` | Solo bares no convertidos |
| `RegisterModal.tsx` | Logs detallados | Depuración fácil |

---

**🚀 ¡Todo listo! Ahora el flujo completo debería funcionar correctamente.**

