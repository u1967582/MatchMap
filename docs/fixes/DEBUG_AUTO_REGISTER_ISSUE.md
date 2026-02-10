# 🔍 Sistema de Depuración Avanzado: Auto-Registro

## 🎯 Problema a Resolver

El sistema NO encuentra el bar pre-registrado cuando el usuario se registra, por lo que:
- ❌ No se llama a la Edge Function
- ❌ No se migran las imágenes
- ❌ El bar no aparece en la app

## ✅ Sistema de Depuración Implementado

He implementado un **sistema de depuración exhaustivo** con múltiples niveles de logs que te permitirá ver **exactamente** qué está fallando.

---

## 📋 Paso a Paso para Depurar

### **Paso 1: Limpia el Caché y Reinicia**

```bash
cd /Users/roger.gost/Documents/repos/MatchMap
expo start -c
```

### **Paso 2: Pre-Registra un Bar (Como Super Usuario)**

1. Inicia sesión como super usuario
2. Ve a "Registrar Bar en Frío"
3. Completa el formulario:
   - **Email**: `test@example.com` (o cualquier email de prueba)
   - Nombre, dirección, etc.
4. Agrega 2-3 fotos del bar
5. Agrega 2-3 fotos del menú
6. Completa el registro

**Verás estos logs detallados**:

```
========================================
💾 GUARDANDO BAR PRE-REGISTRADO
========================================
📧 Email original: "Test@Example.COM"
📧 Email normalizado: "test@example.com"
   - Length: 16
   - Has spaces: false
🏢 Nombre del bar: Test Bar
👤 Created by user: abc-123-...

📦 Payload completo para INSERT:
{
  "name": "Test Bar",
  "email": "test@example.com",
  "status": "pre_registered",
  ...
}

✅ BAR PRE-REGISTRADO EXITOSAMENTE!
   ID: 277b9202-9aad-4efe-a057-4c29dea56f5a
   Email guardado: "test@example.com"
   Status: pre_registered
========================================
```

**📋 Anota el ID y el email guardado**

### **Paso 3: Registra al Usuario con ese Email**

1. Cierra sesión
2. Haz clic en "Registrar"
3. Completa el formulario:
   - **Email**: `test@example.com` (o el que usaste, con cualquier combinación de mayúsculas)
   - Username, nombre, contraseña
4. Envía el formulario

**Verás estos logs SÚPER DETALLADOS**:

```
========================================
🔍 BUSCANDO BAR PRE-REGISTRADO
========================================
📧 Email original: Test@Example.COM
📧 Email normalizado: test@example.com
👤 User ID: xyz-789-...

🔍 DEBUG: Últimas 5 filas en auto_pre_register_bars:
┌─────────┬──────────────────────────────────────┬─────────────────────┬────────────────┬──────────────────┬─────────────────────┐
│ (index) │ id                                   │ email               │ status         │ converted_bar_id │ created_at          │
├─────────┼──────────────────────────────────────┼─────────────────────┼────────────────┼──────────────────┼─────────────────────┤
│ 0       │ '277b9202-9aad-4efe-a057-4c29dea56f5a' │ 'test@example.com'  │ 'pre_registered' │ null             │ '2025-01-15T10:30:00Z' │
│ 1       │ '...'                                 │ 'other@email.com'   │ '...'          │ '...'            │ '...'               │
└─────────┴──────────────────────────────────────┴─────────────────────┴────────────────┴──────────────────┴─────────────────────┘

   Row 1:
   - Email: "test@example.com" (length: 16)
   - Email matches: true  ← ✅ IMPORTANTE
   - Status: "pre_registered"
   - Converted: null
   - Created: 2025-01-15T10:30:00Z

   Row 2:
   - Email: "other@email.com" (length: 15)
   - Email matches: false
   ...
```

**Esto es CLAVE**: Verás una tabla con las últimas 5 filas y podrás comparar:
- ✅ Si el email coincide exactamente
- ✅ Si el status es correcto
- ✅ Si `converted_bar_id` es NULL

Luego verás **3 QUERIES DIFERENTES**:

```
🔎 QUERY 1: Búsqueda simple (solo email):
   Resultados: { found: 1, data: [...] }

🔎 QUERY 2: Búsqueda con email + converted_bar_id IS NULL:
   Resultados: { found: 1, data: [...] }

🔎 QUERY 3: Búsqueda completa (email + status + converted_bar_id):
   Resultados: { found: 1, data: [...] }

✅ Encontrado con query completa
```

**O si hay un problema**:

```
🔎 QUERY 1: Búsqueda simple (solo email):
   Resultados: { found: 0, data: [] }

🔎 QUERY 2: Búsqueda con email + converted_bar_id IS NULL:
   Resultados: { found: 0, data: [] }

🔎 QUERY 3: Búsqueda completa (email + status + converted_bar_id):
   Resultados: { found: 0, data: [] }

❌ NO SE ENCONTRÓ BAR PRE-REGISTRADO CON NINGUNA QUERY
   Posibles razones:
   - Email "test@example.com" no existe en la tabla
   - Revisa los emails en el DEBUG arriba
========================================
```

### **Paso 4: Si Encuentra el Bar**

Verás:

```
✅ BAR PRE-REGISTRADO ENCONTRADO!
   ID: 277b9202-9aad-4efe-a057-4c29dea56f5a
   Nombre: Test Bar
   Email: test@example.com
   Status: pre_registered
   Converted Bar ID: null
   Creado: 2025-01-15T10:30:00Z

🚀 LLAMANDO A EDGE FUNCTION
   URL: https://...supabase.co/functions/v1/promote_pre_registered_bar_with_images
   Payload: { preBarId: "277b9202-...", ownerId: "xyz-789-..." }
📤 Enviando petición...
📥 Respuesta recibida - Status: 200 OK
📦 Response body: { success: true, barId: "...", ... }
✅ BAR PROMOVIDO EXITOSAMENTE!
```

---

## 🔍 Interpretando los Resultados

### ✅ **ESCENARIO 1: Todo Funciona**

```
Row 1:
   - Email: "test@example.com"
   - Email matches: true  ← ✅
   - Status: "pre_registered"  ← ✅
   - Converted: null  ← ✅

🔎 QUERY 1: found: 1  ← ✅
🔎 QUERY 2: found: 1  ← ✅
🔎 QUERY 3: found: 1  ← ✅
✅ Encontrado con query completa
✅ BAR PROMOVIDO EXITOSAMENTE!
```

**Resultado**: Todo funciona correctamente.

---

### ❌ **ESCENARIO 2: Email no Coincide**

```
Row 1:
   - Email: "TEST@EXAMPLE.COM" (length: 16)
   - Email matches: false  ← ❌ PROBLEMA
   - Status: "pre_registered"
   - Converted: null

🔎 QUERY 1: found: 0  ← ❌
```

**Problema**: El email no se normalizó al guardar.

**Solución**: El código ya normaliza el email, pero puede que:
1. Haya datos antiguos en la BD que no están normalizados
2. Necesites limpiar la BD y volver a pre-registrar

```sql
-- Normalizar emails existentes
UPDATE auto_pre_register_bars
SET email = LOWER(TRIM(email));
```

---

### ❌ **ESCENARIO 3: Status Incorrecto**

```
Row 1:
   - Email: "test@example.com"
   - Email matches: true  ← ✅
   - Status: "converted"  ← ❌ PROBLEMA
   - Converted: null

🔎 QUERY 1: found: 1  ← ✅
🔎 QUERY 2: found: 1  ← ✅
🔎 QUERY 3: found: 0  ← ❌ (filtro de status bloquea)
✅ Encontrado sin filtro de status
```

**Problema**: El status no es `'pre_registered'`.

**Solución**: El código usa la query más simple que funcionó (QUERY 2 sin filtro de status), así que debería funcionar igual.

---

### ❌ **ESCENARIO 4: Ya Convertido**

```
Row 1:
   - Email: "test@example.com"
   - Email matches: true  ← ✅
   - Status: "pre_registered"  ← ✅
   - Converted: "abc-123-..."  ← ❌ PROBLEMA (no es NULL)

🔎 QUERY 1: found: 1  ← ✅
🔎 QUERY 2: found: 0  ← ❌ (filtro de converted_bar_id bloquea)
🔎 QUERY 3: found: 0  ← ❌
✅ Encontrado solo con email
```

**Problema**: El bar ya fue convertido (ya tiene `converted_bar_id`).

**Solución**: El código usa la query más simple (QUERY 1 solo con email), así que intentará promoverlo de nuevo. La Edge Function debería manejar esto.

---

### ❌ **ESCENARIO 5: Email No Existe en la Tabla**

```
Row 1:
   - Email: "other@example.com"
   - Email matches: false

Row 2:
   - Email: "another@test.com"
   - Email matches: false

🔎 QUERY 1: found: 0  ← ❌
❌ NO SE ENCONTRÓ BAR PRE-REGISTRADO CON NINGUNA QUERY
```

**Problema**: Realmente no hay un bar pre-registrado con ese email.

**Soluciones posibles**:
1. Verifica que usaste el mismo email en ambos pasos
2. Verifica que el pre-registro se completó correctamente
3. Revisa la BD directamente:

```sql
SELECT id, email, status, converted_bar_id
FROM auto_pre_register_bars
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🛠️ Queries SQL Útiles para Depurar

### Ver todos los bares pre-registrados:

```sql
SELECT 
  id,
  name,
  email,
  status,
  converted_bar_id,
  created_at
FROM auto_pre_register_bars
ORDER BY created_at DESC;
```

### Ver bares sin convertir:

```sql
SELECT * 
FROM auto_pre_register_bars
WHERE converted_bar_id IS NULL
ORDER BY created_at DESC;
```

### Buscar por email específico:

```sql
SELECT * 
FROM auto_pre_register_bars
WHERE email = 'test@example.com';
```

### Normalizar emails existentes:

```sql
UPDATE auto_pre_register_bars
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));
```

### Ver cuántas imágenes tiene un bar pre-registrado:

```sql
SELECT 
  (SELECT COUNT(*) FROM auto_pre_register_bar_images WHERE auto_pre_bar_id = '277b9202-...') as bar_images,
  (SELECT COUNT(*) FROM auto_pre_register_bar_menus WHERE auto_pre_bar_id = '277b9202-...') as menu_images;
```

---

## 🎯 Próximos Pasos

1. **Reinicia la app** con `expo start -c`
2. **Sigue los pasos** de esta guía
3. **Copia los logs completos** que veas en la consola
4. **Analiza** qué query funciona y cuál falla
5. **Comparte los resultados** para diagnóstico

---

## 📊 Resumen del Sistema de Depuración

| Componente | Logs Agregados |
|------------|----------------|
| **Pre-Registro** (`services/bars.ts`) | Email original vs normalizado, payload completo, confirmación de guardado |
| **Búsqueda** (`RegisterModal.tsx`) | 5 últimas filas de la tabla, 3 queries diferentes, comparación detallada |
| **Edge Function** | Petición completa, respuesta, errores detallados |

---

**🚀 Con este sistema de depuración, verás EXACTAMENTE dónde está el problema y podremos solucionarlo.**

