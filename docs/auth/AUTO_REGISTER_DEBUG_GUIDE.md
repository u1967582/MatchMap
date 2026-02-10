# Guía de Depuración: Auto-Registro de Bares

## 📋 Resumen del Flujo

### 1. **Durante el Auto-Registro (Super Usuario)**

Cuando un super usuario pre-registra un bar:

#### Imágenes del Bar:
- **Storage Path**: `<autoPreBarId>/bar/image_bar_1.png`, `image_bar_2.png`, etc.
- **Tabla DB**: `auto_pre_register_bar_images`
- **Campos**:
  - `auto_pre_bar_id`: UUID del pre-registro
  - `file_path`: Path completo en storage (ej: `abc-123/bar/image_bar_1.png`)
  - `image_order`: 1, 2, 3, etc.
  - `description`: 'bar'

#### Imágenes del Menú:
- **Storage Path**: `<autoPreBarId>/menu/image_menu_1.png`, `image_menu_2.png`, etc.
- **Tabla DB**: `auto_pre_register_bar_menus`
- **Campos**:
  - `auto_pre_bar_id`: UUID del pre-registro
  - `file_path`: Path completo en storage (ej: `abc-123/menu/image_menu_1.png`)
  - `image_order`: 1, 2, 3, etc.

---

### 2. **Durante la Promoción (Usuario se Registra)**

Cuando el propietario se registra con el email del pre-registro:

1. **Se crea el bar** en `bars` table (via RPC `promote_pre_registered_bar`)
2. **Se copian las imágenes del bar**: `auto_pre_register_bar_images` → `bar_images`
3. **Se copian las imágenes del menú**: `auto_pre_register_bar_menus` → `bar_menus`
4. **NO se mueven archivos** en storage - mantienen sus paths originales
5. **NO se eliminan registros** de las tablas staging

---

## 🔍 Verificación Paso a Paso

### Paso 1: Verificar la Base de Datos

Después de un auto-registro, ejecuta estas queries en Supabase:

```sql
-- Ver el bar pre-registrado
SELECT * FROM auto_pre_register_bars 
WHERE email = 'email@test.com';

-- Ver imágenes del bar
SELECT * FROM auto_pre_register_bar_images 
WHERE auto_pre_bar_id = '<UUID>';

-- Ver imágenes del menú
SELECT * FROM auto_pre_register_bar_menus 
WHERE auto_pre_bar_id = '<UUID>';
```

**Verifica que**:
- Las imágenes del bar están en `auto_pre_register_bar_images`
- Las imágenes del menú están en `auto_pre_register_bar_menus` (tabla separada)
- `file_path` para imágenes del bar empieza con `<UUID>/bar/`
- `file_path` para imágenes del menú empieza con `<UUID>/menu/`

### Paso 2: Verificar el Storage

Ve a Supabase Dashboard → Storage → `bar-images`:

```
bar-images/
  └── <autoPreBarId>/
      ├── bar/
      │   ├── image_bar_1.png
      │   └── image_bar_2.png
      └── menu/
          ├── image_menu_1.png
          └── image_menu_2.png
```

### Paso 3: Verificar los Logs de la App

Al hacer un auto-registro, deberías ver en la consola:

```
📸 Subiendo 2 imágenes del BAR para auto-registro

=== SUBIENDO IMAGEN PRE-REGISTRO ===
❄️ Tipo: BAR
❄️ Auto Pre Bar ID: abc-123-...
❄️ Orden: 1
📁 Estructura completa del path:
   - autoPreBarId: abc-123-...
   - type (carpeta): bar
   - fileName: image_bar_1.png
   - filePath FINAL: abc-123-.../bar/image_bar_1.png
✅ Imagen de BAR subida exitosamente

💾 [BAR IMAGE] Insertando en auto_pre_register_bar_images: {...}
✅ [BAR IMAGE] Imagen 1 guardada en auto_pre_register_bar_images

---

🍽️ Subiendo 2 imágenes del MENÚ para auto-registro

=== SUBIENDO IMAGEN PRE-REGISTRO ===
❄️ Tipo: MENU
❄️ Auto Pre Bar ID: abc-123-...
❄️ Orden: 1
📁 Estructura completa del path:
   - autoPreBarId: abc-123-...
   - type (carpeta): menu
   - fileName: image_menu_1.png
   - filePath FINAL: abc-123-.../menu/image_menu_1.png
✅ Imagen de MENU subida exitosamente

💾 [MENU IMAGE] Insertando en auto_pre_register_bar_menus: {...}
✅ [MENU IMAGE] Imagen 1 guardada en auto_pre_register_bar_menus
```

---

## 🐛 Problemas Comunes

### Problema 1: Imágenes del menú en carpeta "bar"
**Síntoma**: Todas las imágenes están en `<UUID>/bar/` incluso las del menú.

**Causa posible**:
- El código no se actualizó correctamente
- Cache de la aplicación

**Solución**:
```bash
# Limpiar cache y reinstalar
cd /Users/roger.gost/Documents/repos/MatchMap
rm -rf node_modules/.cache
npm start -- --reset-cache

# O en Expo
expo start -c
```

### Problema 2: Imágenes del menú en tabla incorrecta
**Síntoma**: Imágenes del menú aparecen en `auto_pre_register_bar_images` con `image_order > 100`.

**Causa posible**:
- Código anterior aún ejecutándose
- Base de datos con datos de pruebas anteriores

**Solución**:
1. Limpia los datos de prueba:
```sql
DELETE FROM auto_pre_register_bar_images;
DELETE FROM auto_pre_register_bar_menus;
DELETE FROM auto_pre_register_bars;
```

2. Reinicia la app:
```bash
expo start -c
```

### Problema 3: Archivos no se encuentran después de promoción
**Síntoma**: Al promover el bar, las imágenes no aparecen.

**Causa posible**:
- Los paths en `bar_images` o `bar_menus` no coinciden con los archivos en storage

**Solución**:
Verifica que la Edge Function esté actualizada:
```bash
cd /Users/roger.gost/Documents/repos/MatchMap
supabase functions deploy promote_pre_registered_bar_with_images
```

---

## ✅ Checklist de Verificación

- [ ] El código en `Step4Photos.tsx` tiene logs detallados
- [ ] Las imágenes del bar se suben a `<UUID>/bar/`
- [ ] Las imágenes del menú se suben a `<UUID>/menu/`
- [ ] Las imágenes del bar se guardan en `auto_pre_register_bar_images`
- [ ] Las imágenes del menú se guardan en `auto_pre_register_bar_menus`
- [ ] Los `image_order` son 1, 2, 3... (no 101, 102...)
- [ ] La Edge Function está desplegada
- [ ] La app está corriendo con cache limpio

---

## 🚀 Pasos para Probar

1. **Limpia todo**:
```bash
expo start -c
```

2. **Inicia sesión** como super usuario

3. **Registra un bar en frío**:
   - Agrega 2 fotos del bar
   - Agrega 2 fotos del menú
   - Completa el registro

4. **Verifica los logs** en la consola - deben mostrar claramente:
   - Tipo de imagen (BAR o MENU)
   - Path completo con carpeta correcta
   - Tabla de inserción correcta

5. **Verifica la base de datos**:
```sql
SELECT * FROM auto_pre_register_bar_images ORDER BY image_order;
SELECT * FROM auto_pre_register_bar_menus ORDER BY image_order;
```

6. **Verifica el storage**: Entra a Supabase Dashboard y confirma la estructura de carpetas

---

## 📞 Siguiente Paso

Si después de seguir esta guía el problema persiste:
1. Copia los logs completos de la consola
2. Haz un screenshot del storage en Supabase
3. Comparte los resultados de las queries SQL

