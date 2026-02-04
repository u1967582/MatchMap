# 📜 PUBLICAR POLÍTICA DE PRIVACIDAD - GUÍA COMPLETA

**Fecha**: 4 de Febrero de 2026  
**Archivo**: `/privacy/privacy-policy.html`  
**Estado**: ✅ Creado | ⚠️ Pendiente publicación

---

## 📋 RESUMEN

Apple App Store y Google Play Console **REQUIEREN** una URL pública de política de privacidad antes de lanzar la app al público.

**Opciones disponibles**:
1. **GitHub Pages** (Recomendado) - Gratis, permanente
2. **Netlify** - Gratis, rápido, sin configuración
3. **Tu propio dominio** - Profesional, requiere hosting

---

## ✅ OPCIÓN 1: GITHUB PAGES (RECOMENDADO)

### Ventajas
- ✅ Gratis y permanente
- ✅ URL limpia: `https://tu-usuario.github.io/matchmap-privacy/`
- ✅ Control total del contenido
- ✅ Actualizaciones fáciles (git push)

### Desventajas
- ⚠️ Requiere repo público (o GitHub Pro para privado)
- ⚠️ 5-10 minutos de configuración inicial

### Paso a Paso

#### 1.1 Crear Repositorio Público para Privacy
```bash
# Opción A: Crear repo nuevo solo para privacy (recomendado)
# Ve a: https://github.com/new
# - Repository name: matchmap-privacy
# - Descripción: Privacy Policy for MatchMap iOS/Android App
# - Public: ✅ (obligatorio para GitHub Pages gratis)
# - Add README: ❌
# - Click "Create repository"
```

#### 1.2 Subir el archivo al repo
```bash
# En tu terminal local:
cd /Users/roger.gost/Documents/repos/MatchMap

# Copiar archivo de privacy a directorio temporal
mkdir -p ../matchmap-privacy
cp privacy/privacy-policy.html ../matchmap-privacy/index.html

# Inicializar repo
cd ../matchmap-privacy
git init
git add index.html
git commit -m "Add privacy policy"

# Conectar con GitHub (reemplaza TU-USUARIO)
git remote add origin https://github.com/TU-USUARIO/matchmap-privacy.git
git branch -M main
git push -u origin main
```

#### 1.3 Activar GitHub Pages
1. Ve al repo en GitHub: `https://github.com/TU-USUARIO/matchmap-privacy`
2. Click en **"Settings"** (⚙️)
3. Scroll down hasta **"Pages"** (sidebar izquierdo)
4. En **"Source"**, selecciona:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **"Save"**
6. ✅ Espera 1-2 minutos
7. **Tu URL será**: `https://TU-USUARIO.github.io/matchmap-privacy/`

#### 1.4 Verificar que funciona
```bash
# En el navegador, visita:
https://TU-USUARIO.github.io/matchmap-privacy/

# Deberías ver la política de privacidad formateada
```

#### 1.5 Añadir URL en App Store Connect / Google Play
1. **App Store Connect**:
   - My Apps → MatchMap → Información de la app
   - URL de política de privacidad: `https://TU-USUARIO.github.io/matchmap-privacy/`
   - Guardar

2. **Google Play Console**:
   - App → Política de privacidad
   - URL: `https://TU-USUARIO.github.io/matchmap-privacy/`
   - Guardar

---

## ⚡ OPCIÓN 2: NETLIFY (MÁS RÁPIDO)

### Ventajas
- ✅ 2 minutos de configuración
- ✅ No requiere cuenta de GitHub
- ✅ URL automática: `https://nombre-aleatorio.netlify.app/`
- ✅ Dominio personalizado gratuito (opcional)

### Desventajas
- ⚠️ URL genérica (a menos que configures dominio)
- ⚠️ Menos control a largo plazo

### Paso a Paso

#### 2.1 Preparar archivo
```bash
cd /Users/roger.gost/Documents/repos/MatchMap

# Crear carpeta temporal
mkdir -p /tmp/matchmap-privacy
cp privacy/privacy-policy.html /tmp/matchmap-privacy/index.html
```

#### 2.2 Subir a Netlify Drop
1. Ve a: https://app.netlify.com/drop
2. **Arrastra la carpeta** `/tmp/matchmap-privacy` a la zona de "Drop"
   - ⚠️ Arrastra la CARPETA completa, no solo el archivo
3. ✅ Netlify genera una URL automáticamente
4. **Ejemplo**: `https://matchmap-privacy-abc123.netlify.app/`

#### 2.3 (Opcional) Cambiar nombre del sitio
1. En Netlify, click en **"Site settings"**
2. Click en **"Change site name"**
3. Nombre nuevo: `matchmap-privacy` (si está disponible)
4. **Nueva URL**: `https://matchmap-privacy.netlify.app/`

#### 2.4 Añadir URL en App Store Connect / Google Play
(Mismo proceso que Opción 1.5)

---

## 🌐 OPCIÓN 3: TU PROPIO DOMINIO

Si ya tienes un dominio (ej: `matchmap.com`), puedes alojar la privacy policy ahí.

### Paso a Paso

#### 3.1 Subir archivo a tu hosting
```bash
# Ejemplo con FTP/SFTP:
# Sube privacy/privacy-policy.html a:
# - https://matchmap.com/privacy-policy.html
# - https://www.matchmap.com/privacy.html
# - El path que prefieras
```

#### 3.2 Verificar acceso público
```bash
# En navegador, verifica que funciona:
https://matchmap.com/privacy-policy.html
```

#### 3.3 Añadir URL en App Store Connect / Google Play
(Mismo proceso que Opción 1.5)

---

## 📝 ACTUALIZAR LA POLÍTICA EN EL FUTURO

### Si usas GitHub Pages:
```bash
cd /path/to/matchmap-privacy
nano index.html  # Edita el archivo
git add index.html
git commit -m "Update privacy policy"
git push

# Los cambios aparecen en 1-2 minutos en la URL pública
```

### Si usas Netlify:
1. Edita el archivo localmente
2. Ve a Netlify Dashboard → tu sitio
3. Click **"Deploys"** → **"Upload deploy"**
4. Arrastra la carpeta actualizada

### Si usas tu dominio:
- Sube el archivo actualizado via FTP/SFTP

---

## ⚠️ IMPORTANTE: ANTES DE PUBLICAR

### Verificar contenido
- [ ] Email de contacto correcto (actualmente: `privacy@matchmap.app`)
- [ ] Fecha de última actualización correcta
- [ ] Permisos listados coinciden con la app
- [ ] Proveedores de terceros correctos (Supabase, RevenueCat, Mapbox)

### Actualizar email si es necesario
```bash
# Editar archivo
nano /Users/roger.gost/Documents/repos/MatchMap/privacy/privacy-policy.html

# Buscar: privacy@matchmap.app
# Reemplazar con: tu-email-real@dominio.com
```

---

## ✅ CHECKLIST FINAL

Antes de marcar como completado:

- [ ] **Archivo creado**: ✅ `/privacy/privacy-policy.html`
- [ ] **Método seleccionado**: GitHub Pages / Netlify / Dominio propio
- [ ] **Archivo publicado** en URL pública
- [ ] **URL verificada** (abre en navegador)
- [ ] **URL añadida** en App Store Connect
- [ ] **URL añadida** en Google Play Console (si aplica)
- [ ] **Email de contacto** actualizado en el archivo

---

## 🔗 URLs DE REFERENCIA

| Servicio | URL | Uso |
|----------|-----|-----|
| **GitHub New Repo** | https://github.com/new | Crear repo para privacy |
| **Netlify Drop** | https://app.netlify.com/drop | Upload rápido |
| **App Store Connect** | https://appstoreconnect.apple.com/ | Añadir URL privacy |
| **Google Play Console** | https://play.google.com/console | Añadir URL privacy |

---

## 🆘 TROUBLESHOOTING

### Error: "404 Not Found" en GitHub Pages
**Causa**: El archivo no se llama `index.html` o no está en la raíz  
**Solución**: Asegúrate de que el archivo se llame `index.html` exactamente

### Error: "Privacy policy URL required"
**Causa**: Falta añadir URL en App Store Connect  
**Solución**: Ve a App Info → Privacy Policy URL → pega la URL

### Error: Netlify no acepta el archivo
**Causa**: Estás arrastrando el archivo solo, no la carpeta  
**Solución**: Crea una carpeta, pon `index.html` dentro, arrastra la carpeta

### Cambié el archivo pero no se actualiza en la URL
**Causa**: Cache del navegador  
**Solución**: Abre en modo incógnito o espera 5-10 minutos

---

## 📊 RECOMENDACIÓN FINAL

**Para MatchMap, recomendamos OPCIÓN 1 (GitHub Pages)**:

**Pros**:
- URL profesional y permanente
- Control total del contenido
- Actualizaciones versionadas con Git
- Gratuito sin límites

**Comando rápido**:
```bash
# 1. Crear repo público "matchmap-privacy" en GitHub
# 2. Ejecutar:
cd /Users/roger.gost/Documents/repos/MatchMap
mkdir -p ../matchmap-privacy
cp privacy/privacy-policy.html ../matchmap-privacy/index.html
cd ../matchmap-privacy
git init
git add index.html
git commit -m "Add privacy policy"
git remote add origin https://github.com/TU-USUARIO/matchmap-privacy.git
git branch -M main
git push -u origin main

# 3. Activar GitHub Pages en Settings
# 4. Usar URL: https://TU-USUARIO.github.io/matchmap-privacy/
```

---

**¡Política de privacidad lista para publicar! 🚀**

**Siguiente paso**: `RELEASE_IOS_TESTFLIGHT_CHECKLIST.md` para el checklist final
