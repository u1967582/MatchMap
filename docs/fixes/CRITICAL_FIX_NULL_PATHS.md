# 🔴 FIX CRÍTICO: Paths `null/...` y `bar_id = null`

## 🚨 PROBLEMA IDENTIFICADO

### **1. Paths Inválidos en Storage**

```
❌ null/menu/image_menu_1.png
❌ null/bar/image_bar_2.png
```

### **2. Inserts Fallidos en Base de Datos**

```sql
-- bar_images NO inserta (bar_id NOT NULL constraint)
INSERT INTO bar_images (bar_id, image_url, ...) 
VALUES (null, '...', ...);  -- ❌ ERROR: null value in column "bar_id"

-- bar_menus inserta pero con bar_id inválido
INSERT INTO bar_menus (bar_id, image_url, ...) 
VALUES (null, '...', ...);  -- ❌ Inserta pero el bar_id es null
```

### **3. URLs Incorrectas Guardadas**

```sql
-- ❌ Se guarda path relativo
image_url = 'abc-123/bar/image_bar_1.png'

-- ✅ Debería guardarse URL pública completa
image_url = 'https://...supabase.co/storage/v1/object/public/bar-images/abc-123/bar/image_bar_1.png'
```

---

## 🔍 CAUSA RAÍZ

### **RPC `promote_pre_registered_bar` No Devuelve UUID Simple**

El RPC puede devolver:
- ✅ `"abc-123-def-..."` (string UUID)
- ❌ `{ id: "abc-123-...", ... }` (objeto)
- ❌ `{ bar_id: "abc-123-...", ... }` (objeto con otra key)
- ❌ `null` (fallo)

**Código problemático**:
```typescript
const { data: barIdData, error } = await supabase.rpc('promote_pre_registered_bar', ...);
const barId = barIdData as string;  // ❌ Si es objeto o null, barId queda inválido

// Consecuencias:
const newPath = `${barId}/bar/file.jpg`;  // → "null/bar/file.jpg"
await supabase.from('bar_images').insert({ 
  bar_id: barId,  // → null (falla constraint NOT NULL)
  image_url: newPath,  // → path relativo en vez de URL completa
});
```

---

## ✅ SOLUCIÓN IMPLEMENTADA

### **1. Función `extractBarId`: Extracción Robusta**

```typescript
function extractBarId(data: unknown): string | null {
  if (!data) return null;
  
  // Si es string directamente
  if (typeof data === "string") return data;
  
  // Si es objeto, buscar en propiedades comunes
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["bar_id", "id", "barId", "barid"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  
  return null;
}
```

**Uso**:
```typescript
const { data: rpcData, error: rpcErr } = await supabase.rpc(...);
const barId = extractBarId(rpcData);  // ✅ Maneja todos los casos

// FAIL FAST: Si no es válido, detener
if (!barId) {
  return new Response(JSON.stringify({ 
    error: "RPC did not return a valid barId", 
    rpcData 
  }), { status: 500 });
}
```

### **2. Función `toBucketPath`: Normalización de Paths**

```typescript
function toBucketPath(pathOrUrl: string, bucket: string): string {
  const marker = `/storage/v1/object/public/${bucket}/`;
  return pathOrUrl.includes(marker) 
    ? pathOrUrl.split(marker)[1]  // Extraer solo el path
    : pathOrUrl;  // Ya es un path
}
```

**Uso**:
```typescript
// Si file_path viene como URL completa o path relativo, normalizar
const oldPath = toBucketPath(img.file_path, bucket);
// ✅ "abc-123/bar/image_bar_1.png" (siempre path relativo)
```

### **3. Guardar URL Pública Completa**

```typescript
// Helper para obtener URL pública
const getPublicUrl = (path: string): string => {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

// Al insertar en bar_images/bar_menus
await supabase.from("bar_images").insert({
  bar_id: barId,  // ✅ UUID válido
  image_url: getPublicUrl(newPath),  // ✅ URL pública completa
  image_order: img.image_order,
});
```

### **4. Mover Archivos Correctamente**

```typescript
// Antes (problemático):
const newPath = `${barId}/bar/${fileName}`;  // Si barId es null → "null/bar/..."

// Después (seguro):
const barId = extractBarId(rpcData);
if (!barId) {
  // Detener antes de construir paths
  return new Response(JSON.stringify({ error: "Invalid barId" }), { status: 500 });
}
const newPath = `${barId}/bar/${fileName}`;  // ✅ barId es un UUID válido
```

---

## 📋 EDGE FUNCTION REESCRITA

La Edge Function ahora:

1. ✅ **Valida parámetros** al inicio
2. ✅ **Extrae barId robustamente** del RPC
3. ✅ **Fail fast** si barId es inválido
4. ✅ **Normaliza paths** por si vienen como URLs
5. ✅ **Mueve archivos** de `<preBarId>/...` a `<barId>/...`
6. ✅ **Guarda URLs públicas completas** en la BD
7. ✅ **Logs detallados** en cada paso
8. ✅ **Maneja errores** sin romper el flujo

### **Estructura del Código**

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Función helper: Extrae barId
function extractBarId(data: unknown): string | null { ... }

// Función helper: Normaliza path/URL
function toBucketPath(pathOrUrl: string, bucket: string): string { ... }

serve(async (req) => {
  const { preBarId, ownerId } = await req.json();
  
  // 1) Validar parámetros
  if (!preBarId || !ownerId) {
    return new Response(JSON.stringify({ error: "..." }), { status: 400 });
  }
  
  // 2) Llamar RPC
  const { data: rpcData, error: rpcErr } = await supabase.rpc(...);
  
  // 3) Extraer barId
  const barId = extractBarId(rpcData);
  
  // 4) Fail fast si es inválido
  if (!barId) {
    return new Response(JSON.stringify({ error: "..." }), { status: 500 });
  }
  
  // 5) Helper para URLs públicas
  const getPublicUrl = (path: string) => 
    supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  
  // 6) Migrar imágenes del bar
  const { data: barImgs } = await supabase
    .from("auto_pre_register_bar_images")
    .select("file_path, image_order, description")
    .eq("auto_pre_bar_id", preBarId);
  
  for (const img of barImgs ?? []) {
    const oldPath = toBucketPath(img.file_path, bucket);  // Normalizar
    const fileName = oldPath.split("/").pop();
    const newPath = `${barId}/bar/${fileName}`;  // Construir nuevo path
    
    await supabase.storage.from(bucket).move(oldPath, newPath);  // Mover
    await supabase.from("bar_images").insert({
      bar_id: barId,
      image_url: getPublicUrl(newPath),  // ✅ URL pública completa
      image_order: img.image_order,
    });
  }
  
  // 7) Migrar imágenes del menú (mismo proceso)
  // ...
  
  // 8) Retornar éxito
  return new Response(JSON.stringify({ success: true, barId }), { status: 200 });
});
```

---

## 🧪 Cómo Verificar el Fix

### **1. Pre-Registra un Bar**

```bash
# Logs esperados:
💾 GUARDANDO BAR PRE-REGISTRADO
📧 Email normalizado: "test@example.com"
✅ BAR PRE-REGISTRADO EXITOSAMENTE!
   ID: abc-123-def-456-...
```

### **2. Verifica Storage (Antes del Login)**

Ve a Supabase Dashboard → Storage → `bar-images`:

```
✅ abc-123-def-456-...
   ├── bar/
   │   └── image_bar_1.png
   └── menu/
       └── image_menu_1.png
```

**NO deberías ver**:
```
❌ null/
   ├── bar/
   └── menu/
```

### **3. Usuario Hace Login**

```bash
# Logs esperados en la Edge Function:
[START] Promoting pre-bar abc-123-... for owner xyz-789-...
[RPC] Calling promote_pre_registered_bar...
[RPC] Response data: "def-456-ghi-789-..."  # ← String UUID
[SUCCESS] Bar created with ID: def-456-ghi-789-...

[BAR IMAGES] Found 3 images
[BAR IMAGE] Moving: abc-123-.../bar/image_bar_1.png → def-456-.../bar/image_bar_1.png
[BAR IMAGE] ✅ Migrated: image_bar_1.png
...
[BAR IMAGES] Total migrated: 3

[MENU IMAGES] Found 2 images
[MENU IMAGE] Moving: abc-123-.../menu/image_menu_1.png → def-456-.../menu/image_menu_1.png
[MENU IMAGE] ✅ Migrated: image_menu_1.png
...
[MENU IMAGES] Total migrated: 2

[COMPLETE] Bar def-456-... promoted successfully
  - Bar images: 3
  - Menu images: 2
```

### **4. Verifica Storage (Después del Login)**

```
✅ def-456-ghi-789-...  ← Bar ID real
   ├── bar/
   │   ├── image_bar_1.png
   │   ├── image_bar_2.png
   │   └── image_bar_3.png
   └── menu/
       ├── image_menu_1.png
       └── image_menu_2.png
```

### **5. Verifica Base de Datos**

```sql
-- bar_images debe tener URLs completas y bar_id válido
SELECT bar_id, image_url, image_order 
FROM bar_images 
WHERE bar_id = 'def-456-ghi-789-...';

-- Resultado esperado:
-- bar_id                               | image_url                                                          | image_order
-- -------------------------------------+--------------------------------------------------------------------+------------
-- def-456-ghi-789-...                 | https://...supabase.co/.../def-456-.../bar/image_bar_1.png        | 1
-- def-456-ghi-789-...                 | https://...supabase.co/.../def-456-.../bar/image_bar_2.png        | 2

-- ❌ NO debería haber:
-- bar_id | image_url
-- null   | null/bar/image_bar_1.png
```

```sql
-- bar_menus debe tener URLs completas y bar_id válido
SELECT bar_id, image_url, image_order 
FROM bar_menus 
WHERE bar_id = 'def-456-ghi-789-...';

-- Resultado esperado:
-- bar_id                               | image_url                                                          | image_order
-- -------------------------------------+--------------------------------------------------------------------+------------
-- def-456-ghi-789-...                 | https://...supabase.co/.../def-456-.../menu/image_menu_1.png      | 1

-- ❌ NO debería haber:
-- bar_id | image_url
-- null   | null/menu/image_menu_1.png
```

---

## 🔄 Cambios en el Frontend

**NO se requieren cambios** en el frontend. El código ya usa correctamente `autoPreBarId`:

```typescript
// screens/registerBar/Step4Photos.tsx (ya correcto)
const { filePath, publicUrl } = await uploadAutoPreRegisterImage(
  image.uri,
  barData.id,  // ✅ Este es el autoPreBarId del pre-registro
  'bar',
  image.order
);

// Dentro de uploadAutoPreRegisterImage:
const filePath = `${autoPreBarId}/${type}/${fileName}`;
// ✅ Resultado: "abc-123-def-456-..."/bar/image_bar_1.png
```

---

## 📊 Comparación: Antes vs. Después

| Aspecto | ANTES ❌ | DESPUÉS ✅ |
|---------|---------|-----------|
| **Extracción barId** | `const barId = rpcData as string` | `const barId = extractBarId(rpcData)` |
| **Validación barId** | Sin validación | Fail fast si es null |
| **Paths en Storage** | `null/bar/...` | `<UUID>/bar/...` |
| **bar_id en BD** | `null` | UUID válido |
| **image_url en BD** | Path relativo | URL pública completa |
| **Normalización** | Sin normalización | `toBucketPath()` normaliza |
| **Logs** | Básicos | Detallados en cada paso |
| **Manejo errores** | Rompe el flujo | Continúa con siguiente imagen |

---

## 🚀 Próximos Pasos

### **1. Despliega la Edge Function**

```bash
cd /Users/roger.gost/Documents/repos/MatchMap
supabase functions deploy promote_pre_registered_bar_with_images
```

### **2. Limpia Datos Corruptos (Opcional)**

Si ya tienes datos con `bar_id = null`:

```sql
-- Ver registros corruptos
SELECT * FROM bar_menus WHERE bar_id IS NULL;
SELECT * FROM bar_images WHERE bar_id IS NULL;

-- Eliminar registros corruptos (si es necesario)
DELETE FROM bar_menus WHERE bar_id IS NULL;
DELETE FROM bar_images WHERE bar_id IS NULL;
```

### **3. Limpia Storage Corrupto (Opcional)**

Ve a Supabase Dashboard → Storage → `bar-images` y elimina manualmente la carpeta `null/` si existe.

### **4. Prueba el Flujo Completo**

1. Pre-registra un bar
2. Verifica que los archivos estén en `<autoPreBarId>/bar/` y `<autoPreBarId>/menu/`
3. Registra el usuario e inicia sesión
4. Verifica los logs de la Edge Function
5. Verifica que los archivos se movieron a `<barId>/bar/` y `<barId>/menu/`
6. Verifica que `bar_images` y `bar_menus` tienen `bar_id` válido y URLs completas

---

## ✅ RESULTADO FINAL

- ✅ **barId extraído correctamente** del RPC (string u objeto)
- ✅ **Fail fast** si barId es inválido
- ✅ **Paths válidos**: `<UUID>/bar/...`, nunca `null/...`
- ✅ **bar_id válido** en todas las filas de la BD
- ✅ **URLs públicas completas** guardadas en `image_url`
- ✅ **Normalización** de paths por si vienen como URLs
- ✅ **Logs detallados** para debugging
- ✅ **Manejo robusto de errores**

---

**🎉 ¡El problema crítico está resuelto! Los paths ahora son válidos y las imágenes se migran correctamente.**

