# 🍎 APP STORE CONNECT - CREAR APP PASO A PASO

**Fecha**: 4 de Febrero de 2026  
**App**: MatchMap  
**Bundle ID**: `com.tuorg.matchmap`  
**Plataforma**: iOS

---

## 📋 REQUISITOS PREVIOS

Antes de empezar, asegúrate de tener:

✅ **Apple Developer Program** activo ($99/año)  
✅ **Bundle ID** registrado en Apple Developer Portal  
✅ **Acceso** a App Store Connect como Account Holder o Admin  

---

## 🎯 PASO 1: VERIFICAR/CREAR BUNDLE ID

### 1.1 Acceder a Apple Developer Portal
1. Ve a: https://developer.apple.com/account/
2. Login con tu Apple ID (debe ser el Account Holder o Admin)
3. En el sidebar, click en **"Certificates, Identifiers & Profiles"**

### 1.2 Verificar si el Bundle ID existe
1. Click en **"Identifiers"** (sidebar izquierdo)
2. Busca en la lista: `com.tuorg.matchmap`

**Si EXISTE** ✅:
- Verifica que el tipo sea **"App IDs"**
- Anota las capabilities habilitadas (In-App Purchase, etc.)
- Continúa al Paso 2

**Si NO EXISTE** ⚠️:
- Click en el botón **"+"** (arriba a la izquierda)
- Selecciona **"App IDs"** → **"Continue"**
- Rellena:
  - **Description**: `MatchMap iOS App`
  - **Bundle ID**: Selecciona **"Explicit"**
  - **Bundle ID**: `com.tuorg.matchmap` ⚠️ **CRÍTICO** - debe coincidir con `app.json`
- **Capabilities**: Selecciona las que uses:
  - ✅ In-App Purchase (para RevenueCat)
  - ✅ Push Notifications (si usas notificaciones)
  - ⚠️ NO selecciones lo que no uses (puede causar rechazos)
- Click **"Continue"** → **"Register"**

---

## 🚀 PASO 2: CREAR APP EN APP STORE CONNECT

### 2.1 Acceder a App Store Connect
1. Ve a: https://appstoreconnect.apple.com/
2. Login con tu Apple ID (mismo que Developer Portal)
3. Click en **"My Apps"** (o **"Mis Apps"**)

### 2.2 Crear Nueva App
1. Click en el botón **"+"** (arriba a la izquierda)
2. Selecciona **"Nueva app"** (o **"New App"**)

### 2.3 Rellenar Información Básica

#### a) **Plataforma**
- ✅ Selecciona: **iOS**
- ❌ NO selecciones tvOS (a menos que hagas versión Apple TV)

#### b) **Nombre**
- **Nombre**: `MatchMap` ⚠️ Importante:
  - Máximo 30 caracteres
  - Debe ser único en App Store
  - Este nombre aparecerá en búsquedas y la App Store
  - Puedes cambiarlo después con cada versión

#### c) **Idioma principal**
- Selecciona: **Español** (o **Spanish** si aparece en inglés)
- Puedes añadir más idiomas después

#### d) **Bundle ID**
- **Selecciona de la lista**: `com.tuorg.matchmap`
  - ⚠️ Si NO aparece, vuelve al Paso 1.2
  - ⚠️ Una vez seleccionado, NO se puede cambiar

#### e) **SKU**
- **SKU**: `matchmap` o `matchmap-ios`
  - Es un identificador interno, solo para ti
  - No lo ve el usuario
  - Sugerencia: usa el nombre de la app en minúsculas

#### f) **Acceso de usuario**
- Selecciona: **"Acceso completo"** (Full Access)
  - Esto permite que todos los miembros del equipo puedan verla

### 2.4 Confirmar Creación
1. Revisa que todo esté correcto
2. Click en **"Crear"** (o **"Create"**)
3. ✅ La app se creará y te llevará a la página de administración

---

## 📝 PASO 3: CONFIGURAR INFORMACIÓN BÁSICA

Ahora que la app está creada, necesitas rellenar información mínima antes de subir a TestFlight.

### 3.1 Información de la App

#### a) **Categoría**
1. En el sidebar, click en **"Información de la app"** (o **"App Information"**)
2. **Categoría principal**: Selecciona la más apropiada:
   - Sugerencia: **"Comida y bebida"** (Food & Drink)
   - Alternativa: **"Viajes"** (Travel) o **"Estilo de vida"** (Lifestyle)
3. **Categoría secundaria** (opcional): Elige otra si aplica
4. Click **"Guardar"** (arriba a la derecha)

#### b) **Clasificación de contenido**
1. Scroll down hasta **"Clasificación de contenido"**
2. Click **"Editar"** (si no lo has hecho)
3. Responde el cuestionario:
   - La mayoría de respuestas para MatchMap serán **"No"** o **"Ninguno"**
   - Si muestras alcohol: marca **"Referencias poco frecuentes/moderadas al consumo de alcohol, tabaco o drogas"**
4. Click **"Listo"**

### 3.2 Precios y Disponibilidad
1. En el sidebar, click en **"Precios y disponibilidad"** (Pricing and Availability)
2. **Precio**: Selecciona **"Gratis"** (Free)
   - ⚠️ Aunque tengas IAP, la descarga es gratis
3. **Disponibilidad**: Selecciona los países donde estará disponible
   - Sugerencia: Empieza solo con **España** para testing
   - Puedes añadir más países después
4. Click **"Guardar"**

---

## 🧪 PASO 4: PREPARAR PARA TESTFLIGHT

### 4.1 Información Mínima Requerida
Para subir a TestFlight, **NO necesitas**:
- ❌ Capturas de pantalla
- ❌ Descripción completa
- ❌ Icono de marketing (1024x1024)
- ❌ URL de política de privacidad (para TestFlight)

**SÍ necesitas**:
- ✅ App creada (ya hecho en Paso 2)
- ✅ Bundle ID configurado
- ✅ Build subida desde EAS

### 4.2 Configurar TestFlight
1. En el sidebar, click en **"TestFlight"**
2. **Información de prueba**:
   - **¿Qué probar?**: Escribe qué quieres que testen
   - Ejemplo: `Testear funciones de búsqueda de bares, mapa y sistema de Boost`
3. **Contacto de revisión** (para Apple):
   - Nombre: Tu nombre
   - Email: Tu email
   - Teléfono: Tu teléfono
4. **Información de inicio de sesión** (si aplica):
   - Si requiere login, proporciona credenciales de prueba
   - Ejemplo:
     ```
     Email: test@matchmap.com
     Password: TestPassword123
     ```
5. Click **"Guardar"**

### 4.3 Añadir Testers Internos (Opcional)
1. En **TestFlight**, click en **"Testers Internos"**
2. Click **"+"** para añadir
3. Selecciona miembros de tu equipo
4. Click **"Añadir"**

**Testers Internos**:
- Reciben builds automáticamente
- Sin límite de instalaciones
- No requieren aprobación de Apple

---

## 📱 PASO 5: CONFIGURAR PARA PRODUCCIÓN (DESPUÉS DE TESTFLIGHT)

**⚠️ ESTO ES PARA MÁS ADELANTE** - Solo cuando estés listo para lanzar al público.

### 5.1 Preparar Capturas de Pantalla
Necesitas capturas para:
- iPhone 6.7" (iPhone 15 Pro Max) - **OBLIGATORIO**
- iPhone 6.5" (iPhone 14 Plus) - Recomendado
- iPad Pro (12.9") - Si soportas iPad

**Tamaños**:
- iPhone 6.7": 1290 x 2796 pixels
- iPhone 6.5": 1284 x 2778 pixels

**Herramientas**:
- Simulator (Xcode)
- https://www.screenshotone.com/
- Figma/Canva para diseñar marcos

### 5.2 Crear Icono de Marketing
- **Tamaño**: 1024 x 1024 pixels
- **Formato**: PNG o JPEG
- **Sin alpha channel** (sin transparencia)
- **Sin esquinas redondeadas** (Apple las añade automáticamente)

### 5.3 Rellenar Metadatos Completos

#### a) **Descripción de la App**
- **Texto promocional** (máx. 170 caracteres):
  - Ejemplo: `Encuentra bares para ver partidos cerca de ti. Descubre eventos, ofertas y retransmisiones en tiempo real.`
- **Descripción** (máx. 4000 caracteres):
  - Escribe qué hace la app, beneficios, características clave
  - Usa keywords para SEO (sin abusar)
  
#### b) **Palabras clave**
- **Máximo**: 100 caracteres (separados por comas, sin espacios)
- **Ejemplo**: `bares,futbol,partidos,deportes,eventos,cerveza,streaming,directo`
- ⚠️ NO uses: nombre de la app, nombres de apps competidoras, palabras irrelevantes

#### c) **URL de soporte**
- **Formato**: `https://tu-dominio.com/support`
- **Debe funcionar** (Apple lo verifica)
- Puede ser una sección de tu web o un email de contacto

#### d) **URL de política de privacidad** ⚠️ **OBLIGATORIO**
- **Formato**: `https://tu-dominio.com/privacy-policy.html`
- **Debe ser pública** y accesible
- Ver `PRIVACY_POLICY_PUBLISH.md` para instrucciones

#### e) **URL de marketing** (opcional)
- Tu web principal: `https://matchmap.com`

---

## ⚠️ INFORMACIÓN IMPORTANTE

### Bundle ID - NO se puede cambiar
- Una vez seleccionado el Bundle ID, **NO se puede modificar**
- Si necesitas cambiarlo, debes crear una nueva app desde cero
- ⚠️ Asegúrate de que `com.tuorg.matchmap` es el correcto antes de crear

### Nombre de la App
- ✅ Se puede cambiar con cada versión nueva
- Cambios requieren nueva revisión de Apple
- El nombre en TestFlight puede ser diferente al de producción

### SKU
- Es solo interno, no lo ve el usuario
- NO se puede cambiar después de crear la app
- No importa mucho, elige algo simple

### Política de Privacidad
- **OBLIGATORIO** antes de lanzar a producción
- **NO obligatorio** para TestFlight (testers internos)
- Debe estar en URL pública antes de "Submit for Review"

---

## ✅ CHECKLIST - APP CREADA CORRECTAMENTE

Verifica que tengas todo:

- [ ] **Bundle ID** seleccionado: `com.tuorg.matchmap`
- [ ] **Nombre** configurado: `MatchMap`
- [ ] **SKU** configurado (ej: `matchmap`)
- [ ] **Categoría** seleccionada (ej: Comida y bebida)
- [ ] **Clasificación de contenido** completada
- [ ] **Precio** configurado: Gratis
- [ ] **Disponibilidad** configurada (países)
- [ ] **TestFlight** configurado con info de prueba
- [ ] **Contacto de revisión** añadido

---

## 🚀 PRÓXIMOS PASOS

Una vez completado esto:

1. **Configurar productos IAP** → Ver `REVENUECAT_IOS_SETUP.md`
2. **Subir build desde EAS**:
   ```bash
   eas build --platform ios --profile production-ios
   ```
3. **Esperar processing** (5-10 minutos)
4. **Añadir testers** en TestFlight
5. **Distribuir** build a testers

---

## 🆘 TROUBLESHOOTING

### Error: "Bundle ID already in use"
**Causa**: Otra app ya usa ese Bundle ID  
**Solución**: Elige otro Bundle ID único (cambia en `app.json` también)

### Error: "Bundle ID not found in list"
**Causa**: No está registrado en Developer Portal  
**Solución**: Vuelve al Paso 1.2 y créalo

### Error: "You don't have permission"
**Causa**: Tu rol en el equipo no permite crear apps  
**Solución**: Pide al Account Holder que te dé permisos de Admin

### App creada pero no aparece en TestFlight
**Causa**: Normal - aparecerá después de subir la primera build  
**Solución**: Ejecuta `eas build` y espera el processing

---

## 📚 RECURSOS

- **App Store Connect**: https://appstoreconnect.apple.com/
- **Apple Developer**: https://developer.apple.com/account/
- **Guía oficial**: https://developer.apple.com/app-store-connect/
- **TestFlight**: https://developer.apple.com/testflight/

---

**¡App creada y lista para recibir builds! 🎉**

**Siguiente paso**: `REVENUECAT_IOS_SETUP.md` para configurar productos
