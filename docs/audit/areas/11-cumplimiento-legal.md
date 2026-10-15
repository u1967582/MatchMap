# 11 · Cumplimiento de tiendas y legal

**Prioridad:** 🔴 · **Ejecución:** ☁️ revisión y textos · 👤 paneles de App Store Connect y Play Console · **Rama:** `audit/11-cumplimiento-legal`

## Objetivo
Pasar la revisión de Apple y Google a la primera y cumplir RGPD.

## Checklist
### Privacidad y RGPD
- [ ] **Política de privacidad (HALLAZGOS #22):** URL pública, en español, que mencione: ubicación, cuenta y perfil, fotos subidas, reseñas, notificaciones push, AdMob (IDFA/AAID, consentimiento), RevenueCat y compras, Mapbox, Supabase (dónde se alojan los datos), monitorización de errores (D4), plazos de conservación, borrado de cuenta y contacto del responsable.
- [ ] **Términos de uso** con normas de contenido (reseñas y posts) y política de tolerancia cero con contenido ofensivo (Apple 1.2).
- [ ] **Consentimiento de anuncios:** formulario UMP de Google en el EEE antes de cargar anuncios; ATT en iOS antes de acceder al IDFA. Si se rechaza, anuncios no personalizados.
- [ ] Enlaces a privacidad y términos dentro de la app (registro y perfil).

### App Store
- [ ] **Etiqueta de privacidad** de App Store Connect coherente con la política y con los SDKs (AdMob, RevenueCat, Mapbox, monitorización).
- [ ] **Privacy manifest** (`PrivacyInfo.xcprivacy`) con las *required reason APIs* de la app y los SDKs incluidos en el build.
- [ ] **Sign in with Apple** presente (4.8). **Borrado de cuenta** en la app (5.1.1(v)).
- [ ] **UGC (1.2):** reportar contenido, bloquear usuarios, moderación y contacto (enlaza con 03).
- [ ] **Compras:** los Boost son consumibles vía IAP; no hay enlaces a pagos externos.
- [ ] **Notas para el revisor:** cuenta demo (D6), cómo ver un bar con Boost, cómo funciona el modo invitado, que la ubicación es para mostrar bares cercanos.
- [ ] Clasificación por edades (hay contenido de apuestas: `is_betting_venue` → revisar el cuestionario y si hace falta 17+/18+ o restringir países).

### Google Play
- [ ] **Data safety** coherente con la política y los SDKs.
- [ ] **Borrado de cuenta:** URL web declarada en Play Console.
- [ ] **Declaración de anuncios**, ID de publicidad (`AD_ID`), público objetivo (no infantil), cuestionario de clasificación de contenido.
- [ ] **Permisos sensibles:** si se usa ubicación en segundo plano, declaración y vídeo; si no, quitar el permiso (ver 10).
- [ ] Prueba cerrada de 14 días si aplica (D2).

### Fichas de tienda
- [ ] Nombre, subtítulo, descripción corta y larga, palabras clave (ASO) en español.
- [ ] Capturas para iPhone 6,9" y 6,5" y para Android; icono 512 px y gráfico destacado 1024×500 para Play.
- [ ] URL de soporte y de marketing; email de contacto.

## Criterios de aceptación
- Checklist completa marcada antes de enviar a revisión; respuestas del cuestionario de privacidad guardadas en este fichero.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=11, nombre=cumplimiento-legal]
Específico del área: inventaría todos los datos que la app recoge leyendo el código (tablas de
Supabase, SDKs en package.json, permisos) y genera en este fichero una tabla «dato → para qué → con
quién se comparte → se puede borrar», que servirá para la etiqueta de Apple, Data safety y la política
de privacidad (docs/legal y privacy/). Comprueba UMP/ATT en utils/ads.ts y contexts/AdsContext.tsx y
el privacy manifest. Redacta borradores de ficha de tienda en docs/audit/store-listing.md.
```
