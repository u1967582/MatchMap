# 11 · Cumplimiento de tiendas y legal

**Prioridad:** 🔴 · **Ejecución:** ☁️ revisión y textos · 👤 paneles de App Store Connect y Play Console · **Rama:** `audit/11-cumplimiento-legal`

## Objetivo
Pasar la revisión de Apple y Google a la primera y cumplir RGPD.

## Checklist
Leyenda de las notas: ✅ verificado en código · 🛠 arreglado en esta PR · 👤 lo tienes que hacer tú en un panel · ⚠️ a verificar por el usuario.

### Privacidad y RGPD
- [ ] **Política de privacidad (HALLAZGOS #22):** URL pública, en español, que mencione: ubicación, cuenta y perfil, fotos subidas, reseñas, notificaciones push, AdMob (IDFA/AAID, consentimiento), RevenueCat y compras, Mapbox, Supabase (dónde se alojan los datos), monitorización de errores (D4), plazos de conservación, borrado de cuenta y contacto del responsable.
  → Las versiones del repo (`privacy/*.html`) están **incompletas e incorrectas** (11-H4). La que enlaza la app está en Notion y no se puede leer sin navegador (⚠️). Borrador completo en [`../politica-privacidad-borrador.md`](../politica-privacidad-borrador.md); 👤 completar los huecos `[…]`, revisarlo y publicarlo.
- [ ] **Términos de uso** con normas de contenido (reseñas y posts) y política de tolerancia cero con contenido ofensivo (Apple 1.2).
  → ⚠️ Están en Notion; no se han podido leer. Comprobar que incluyen normas de contenido, tolerancia cero, retirada de contenido y expulsión de usuarios (11-H5).
- [x] **Consentimiento de anuncios:** formulario UMP de Google en el EEE antes de cargar anuncios; ATT en iOS antes de acceder al IDFA. Si se rechaza, anuncios no personalizados.
  → ✅ El App Open Ad ya esperaba a UMP. 🛠 Los banners **no** esperaban (11-H1), faltaba el acceso para cambiar el consentimiento (11-H2) y el ATT podía pedirse con la app sin estar activa (11-H3). Si el usuario rechaza en el formulario de UMP, el SDK lee la cadena TCF y sirve anuncios limitados o no personalizados por sí solo; si `canRequestAds` es false no se pide ningún anuncio. Si se deniega ATT, AdMob no recibe el IDFA. 👤 Prueba en dispositivo con `debugGeography` EEE o una VPN.
- [x] Enlaces a privacidad y términos dentro de la app (registro y perfil).
  → ✅ `screens/WelcomeScreen.tsx` («Al continuar, aceptas…») y `screens/ProfileScreen.tsx` (Configuración de cuenta).

### App Store
- [ ] **Etiqueta de privacidad** de App Store Connect coherente con la política y con los SDKs (AdMob, RevenueCat, Mapbox, monitorización).
  → Propuesta de respuestas en [Cuestionarios](#cuestionarios-de-privacidad-propuesta). 👤 rellenar en App Store Connect.
- [ ] **Privacy manifest** (`PrivacyInfo.xcprivacy`) con las *required reason APIs* de la app y los SDKs incluidos en el build.
  → ✅ No hay `ios/` en el repo (CNG). Un `expo prebuild` de prueba genera `Podfile.properties.json` con `apple.privacyManifestAggregationEnabled: true`, así que `pod install` crea el `PrivacyInfo.xcprivacy` de la app agregando las *required reason APIs* de los pods. Los SDK nativos (Google Mobile Ads, RevenueCat, Mapbox, Expo) traen su propio manifiesto. 👤 Verificarlo en el archive de EAS con Xcode → *Generate Privacy Report* (11-H10).
- [x] **Sign in with Apple** presente (4.8). **Borrado de cuenta** en la app (5.1.1(v)).
  → ✅ `utils/auth.ts` `signInWithApple` + `usesAppleSignIn` en `app.json`; Google también disponible. Borrado en Editar perfil → `deleteAccount()` → edge function `delete-user-account` + `delete_user_data` (prueba funcional en el área 02).
- [ ] **UGC (1.2):** reportar contenido, bloquear usuarios, moderación y contacto (enlaza con 03).
  → 🔴 11-H5: no se pueden reportar reseñas ni posts ni bloquear usuarios. El reporte de reseñas lo implementa el área 03. El **bloqueo de usuarios no tiene responsable**.
- [x] **Compras:** los Boost son consumibles vía IAP; no hay enlaces a pagos externos.
  → ✅ No hay referencias a Stripe/PayPal/transferencia; los Boost van por RevenueCat (`react-native-purchases`).
- [x] **Notas para el revisor:** cuenta demo (D6), cómo ver un bar con Boost, cómo funciona el modo invitado, que la ubicación es para mostrar bares cercanos.
  → Borrador en [`../store-listing.md`](../store-listing.md). 👤 Falta crear la cuenta demo (D6).
- [ ] Clasificación por edades (hay contenido de apuestas: `is_betting_venue` → revisar el cuestionario y si hace falta 17+/18+ o restringir países).
  → 11-H8. ✅ Los bares de apuestas están ocultos por defecto y solo se muestran tras una autodeclaración de mayoría de edad (`BettingBarsAgeGatePopup`, `users.is_adult_confirmed`). La app no ofrece juego con dinero real. 👤 Responder el cuestionario: ver la propuesta en la sección del hallazgo.

### Google Play
- [ ] **Data safety** coherente con la política y los SDKs.
  → Propuesta en [Cuestionarios](#cuestionarios-de-privacidad-propuesta). 👤 rellenar en Play Console.
- [ ] **Borrado de cuenta:** URL web declarada en Play Console.
  → 🟠 11-H6: no existe ninguna página web para pedir el borrado. 👤 Publicar una (texto propuesto en el borrador de política, sección 9) y declararla.
- [ ] **Declaración de anuncios**, ID de publicidad (`AD_ID`), público objetivo (no infantil), cuestionario de clasificación de contenido.
  → ✅ `app.json` declara `com.google.android.gms.permission.AD_ID` y la app usa AdMob, así que en Play hay que responder «Sí, contiene anuncios» y «Sí, usa el ID de publicidad (publicidad)». 👤 Público objetivo: solo 18+ o 13+ (no infantil, ver 11-H8).
- [x] **Permisos sensibles:** si se usa ubicación en segundo plano, declaración y vídeo; si no, quitar el permiso (ver 10).
  → ✅ Solo `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION`; `locationAlwaysPermission: false`, sin `ACCESS_BACKGROUND_LOCATION`. `RECORD_AUDIO` bloqueado. No hace falta declaración.
- [ ] Prueba cerrada de 14 días si aplica (D2).

### Fichas de tienda
- [x] Nombre, subtítulo, descripción corta y larga, palabras clave (ASO) en español.
  → Borrador en [`../store-listing.md`](../store-listing.md).
- [ ] Capturas para iPhone 6,9" y 6,5" y para Android; icono 512 px y gráfico destacado 1024×500 para Play.
- [ ] URL de soporte y de marketing; email de contacto.
  → 🟠 11-H7: los emails de contacto no coinciden (`support@matchmap.com` en la app y `privacy@matchmap.app` en la política).

## Criterios de aceptación
- Checklist completa marcada antes de enviar a revisión; respuestas del cuestionario de privacidad guardadas en este fichero.

## Inventario de datos
Sacado del código el 2026-10-15: `supabase/migrations`, llamadas `.from()`/`.rpc()`/`storage` de la app, `package.json` y `app.json`. Supabase es el backend (encargado del tratamiento) de todo lo marcado «Supabase». «Borrable» = lo elimina el borrado de cuenta (`delete-user-account` → `delete_user_data` + storage + `auth.admin.deleteUser`).

| Dato | Dónde | Para qué | Con quién se comparte | ¿Se borra con la cuenta? |
|---|---|---|---|---|
| Email | `auth.users`; login con email, Google o Apple | Cuenta, inicio de sesión, recuperar contraseña | Supabase (Auth); Google/Apple si se usa su login | Sí |
| Contraseña (hash) | `auth.users` | Login | Supabase | Sí |
| Nombre, nombre de usuario, foto de perfil | `users.full_name`, `username`, `profile_image_url`; bucket `avatars` | Perfil; se muestran junto a las reseñas | Público en la app; Supabase | Sí (fila y carpeta `avatars/<uid>`) |
| ID de usuario (UUID) | Todas las tablas | Identificar la cuenta | Supabase; RevenueCat (`appUserID`) | Supabase sí. ⚠️ RevenueCat **no** (11-H13) |
| Usuario invitado (sesión anónima) | `auth.users` con `is_anonymous` | Explorar sin cuenta | Supabase | ⚠️ No hay borrado; quedan usuarios anónimos huérfanos (76 en prod según HALLAZGOS #4) |
| Equipo favorito, preferencia de avisos | `users.favorite_team_id`, `match_notifications_enabled` | Avisar 2 h antes de los partidos del equipo | Supabase | Sí |
| Mayoría de edad autodeclarada, mostrar bares de apuestas | `users.is_adult_confirmed`, `show_betting_bars` | Filtro de bares de apuestas (18+) | Supabase | Sí |
| Ubicación precisa (solo en primer plano) | Solo en el dispositivo (mapa, distancias); **no se guarda en Supabase** | Mostrar bares cercanos | Mapbox: coordenadas de origen al pedir una ruta (`hooks/useMapboxDirections.ts`) y telemetría del SDK si está activa (11-H9) | No se guarda |
| Visitas por proximidad | `bar_proximity_visits` | Estadísticas para propietarios | — | Sí (cascada). **Desactivado** en `components/Map.tsx` (`PROXIMITY_TRACKING_ENABLED = false`) |
| Interacciones con bares | `bar_analytics_events` (ver ficha, carta, clic en teléfono/dirección/web; 1 fila por bar, usuario, tipo y día) | Estadísticas agregadas para el dueño del bar | Propietario del bar (solo agregados vía `fn_get_bar_stats_*`) | Sí (cascada) |
| Favoritos y «me gusta» en reseñas | `favorites`, `review_likes` | Funcionalidad | Supabase | Sí (cascada) |
| Reseñas (texto, puntuación) | `reviews` | Contenido público | Público en la app | Sí (se **borran**, no se anonimizan) |
| Reportes de bares | `bar_reports` (motivo, mensaje) | Moderación | Administradores | Sí |
| Solicitudes de reclamación de bar | `bar_claims` (nombre, teléfono, mensaje) y documentos en bucket privado `bar-claim-documents` | Verificar que es el dueño | Administradores | Sí |
| Solicitudes de alta de bar | `bar_requests` (nombre, teléfono y email del dueño, ciudad, notas) | Dar de alta bares | Administradores | Sí (FK `ON DELETE CASCADE` a `auth.users`) |
| Bares del propietario | `bars` y tablas hijas; imágenes y carta en `bar-images`; posts en `bar_posts` | Ficha pública del bar | Público en la app | Sí (bar, tablas hijas e imágenes) |
| Tickets de soporte | `support_tickets` (email, asunto, mensaje, categoría) | Atender soporte | Administradores | Sí |
| Token de notificaciones push | `push_tokens` (token Expo, plataforma, `device_id`); `match_notifications_sent` | Enviar avisos de partidos | Expo Push Service → APNs (Apple) / FCM (Google) | Sí (cascada) |
| Compras de Boost | RevenueCat (recibos, historial); `bar_boosts`, `boost_payments` | Activar el Boost | RevenueCat; Apple/Google (cobro) | En Supabase se anonimizan (`user_id = NULL`) y se conservan. RevenueCat las conserva |
| Ingresos por anuncio | `Purchases.adTracker.trackAdRevenue` (`utils/revenuecat.ts`) | Medir ingresos | RevenueCat | No (RevenueCat) |
| Identificador de publicidad (IDFA/AAID), IP, datos del dispositivo e interacción con anuncios | SDK Google Mobile Ads | Publicidad (personalizada solo con consentimiento UMP y, en iOS, ATT) | Google (AdMob) y sus socios publicitarios según el consentimiento | No (lo gestiona Google; el usuario puede revocar el consentimiento en Perfil → Privacidad de anuncios o resetear el ID en el sistema) |
| Datos de diagnóstico | No hay Sentry/Crashlytics (D4). AdMob y Mapbox recogen diagnósticos de su SDK | — | Google, Mapbox | — |
| Email de preinscripción | `user_pre_registrations` (inserción anónima; no la usa la app) | ⚠️ Preinscripción web | Supabase | No ligado a la cuenta. ⚠️ Mencionarlo en la política si la web sigue activa |
| Errores de auth (legacy) | `auth_errors` (`migrations/create_oauth_user_trigger.sql`) | ⚠️ Depuración antigua | Supabase | ⚠️ Comprobar en prod si existe y qué guarda; si guarda emails, borrarla o incluirla en la limpieza |

Permisos del dispositivo (`app.json`): ubicación «mientras se usa» (iOS) y `ACCESS_COARSE/FINE_LOCATION` (Android); cámara y fotos (subir imágenes); notificaciones (`expo-notifications`); seguimiento ATT (`NSUserTrackingUsageDescription` vía el plugin de AdMob); `AD_ID` en Android. Sin micrófono, sin ubicación en segundo plano, sin contactos.

## Cuestionarios de privacidad (propuesta)
⚠️ Son una propuesta a partir del código. Las respuestas sobre lo que recogen los SDK de terceros deben contrastarse con la documentación de cada proveedor (Google publica la guía de *Data safety* y de la etiqueta de Apple para el SDK de Google Mobile Ads; RevenueCat y Mapbox tienen la suya).

### App Store Connect · Privacidad de la app
- **¿Recoges datos?** Sí. **¿Rastreo (tracking)?** Sí: AdMob usa el IDFA para anuncios personalizados cuando el usuario lo autoriza en ATT. Declarar «Identificador del dispositivo» como usado para rastreo.

| Tipo de dato (Apple) | Uso | ¿Vinculado al usuario? | ¿Rastreo? |
|---|---|---|---|
| Información de contacto · Correo electrónico | Funcionalidad de la app | Sí | No |
| Información de contacto · Nombre | Funcionalidad de la app | Sí | No |
| Información de contacto · Teléfono (solo propietarios) | Funcionalidad de la app | Sí | No |
| Contenido del usuario · Fotos | Funcionalidad de la app | Sí | No |
| Contenido del usuario · Atención al cliente | Funcionalidad de la app | Sí | No |
| Contenido del usuario · Otro contenido (reseñas, posts) | Funcionalidad de la app | Sí | No |
| Identificadores · ID de usuario | Funcionalidad de la app | Sí | No |
| Identificadores · ID del dispositivo (IDFA; token push) | Publicidad de terceros; funcionalidad de la app | No | Sí (IDFA, solo con ATT) |
| Compras · Historial de compras | Funcionalidad de la app | Sí | No |
| Ubicación · Precisa | Funcionalidad de la app (rutas con Mapbox) | No | No |
| Ubicación · Aproximada | Publicidad de terceros (AdMob, por IP) | No | ⚠️ según guía de Google |
| Uso · Interacción con el producto | Analítica (estadísticas para dueños de bares) | Sí | No |
| Uso · Datos de publicidad | Publicidad de terceros | No | Sí (con ATT) |
| Diagnóstico · Rendimiento / otros | Publicidad de terceros (SDK AdMob); añadir *Datos de fallos* si se integra Sentry (D4) | No | No |

### Google Play · Seguridad de los datos
- **¿Recoge o comparte datos?** Sí. **¿Cifrados en tránsito?** Sí (HTTPS). **¿Se puede pedir el borrado?** Sí: en la app y en la URL web (pendiente, 11-H6).
- Supabase, RevenueCat, Expo y Mapbox actúan como proveedores de servicios: según la definición de Play, lo que procesan por cuenta de la app cuenta como **recogido**, no como **compartido**. AdMob: ⚠️ seguir la guía de Google para el SDK de anuncios (normalmente *recogido* y *compartido* para publicidad).

| Categoría (Play) | Dato | Recogido / compartido | Finalidad | ¿Opcional? |
|---|---|---|---|---|
| Información personal | Email, nombre, ID de usuario, teléfono (propietarios) | Recogido | Funcionalidad de la app, gestión de la cuenta | Email obligatorio para cuenta; teléfono opcional |
| Fotos y vídeos | Fotos | Recogido | Funcionalidad de la app | Opcional |
| Mensajes / otro contenido | Tickets de soporte, reseñas, posts | Recogido | Funcionalidad de la app, atención al cliente | Opcional |
| Ubicación | Ubicación precisa | Recogido (Mapbox, rutas) | Funcionalidad de la app | Opcional |
| Ubicación | Ubicación aproximada | ⚠️ AdMob (IP) | Publicidad | — |
| Información financiera | Historial de compras | Recogido | Funcionalidad de la app | Opcional |
| Actividad en la app | Interacciones con la app | Recogido | Analítica | — |
| Actividad en la app | Interacciones con anuncios | ⚠️ AdMob | Publicidad | — |
| Información y rendimiento de la app | Diagnósticos | ⚠️ AdMob/Mapbox | Publicidad, analítica | — |
| ID de dispositivo u otros | AAID, token push | Recogido; AAID ⚠️ compartido con AdMob | Publicidad, funcionalidad (push) | — |

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| 11-H1 | 🔴 | **Los banners pedían anuncios antes del consentimiento UMP.** `components/ads/AdBanner.tsx` montaba `BannerAd` sin esperar a `initializeAdsSDK()`. En el mapa (primera pantalla tras el login), la búsqueda, el perfil, los favoritos y la ficha de bar se pedía un anuncio aunque el formulario de UMP no se hubiera resuelto o el usuario del EEE no hubiera dado consentimiento (`canRequestAds = false`). Eso incumple la política de consentimiento de usuarios de la UE de Google y el RGPD. | 🛠 Arreglado: `AdsContext` expone `adsReady` y `AdBanner` no se monta hasta que vale `true`. Tests en `components/ads/__tests__/AdBanner.test.tsx` y `contexts/__tests__/AdsContext.test.tsx`. |
| 11-H2 | 🟠 | **No había forma de cambiar o retirar el consentimiento de anuncios.** UMP marca `privacyOptionsRequirementStatus = REQUIRED` en el EEE y Google exige un acceso permanente al formulario de opciones de privacidad (RGPD art. 7.3: retirarlo debe ser tan fácil como darlo). | 🛠 Arreglado: `showAdsPrivacyOptions()` / `isAdsPrivacyOptionsRequired()` en `utils/ads.ts` y la fila «Privacidad de anuncios» en Perfil, visible solo cuando UMP la exige. Si el usuario retira el consentimiento, `adsReady` pasa a `false`; si lo da, se inicializa el SDK. |
| 11-H3 | 🟠 | **ATT podía pedirse con la app sin estar activa.** iOS no muestra el diálogo si la app no está en `active`. Fuera del EEE, UMP no muestra formulario y la petición ocurre en el arranque. Apple rechaza los builds en los que el revisor no ve el diálogo de ATT aunque la app declare que rastrea. | 🛠 Arreglado: `waitForAppActive()` antes de `requestTrackingPermissionsAsync()`. Orden garantizado: UMP → ATT → `initialize` (test). 👤 Verificar en un dispositivo físico con el build de producción. |
| 11-H4 | 🔴 | **La política de privacidad del repo está incompleta y tiene afirmaciones falsas.** `privacy/privacy-policy.html` y `privacy/index.html` no mencionan AdMob, IDFA/AAID, ATT ni UMP, las notificaciones push (Expo/APNs/FCM), el login con Apple, la identidad del responsable, las bases jurídicas, el derecho a reclamar ante la AEPD ni plazos concretos. Además afirman que las reseñas se conservan anonimizadas (se borran), que hay soporte en «Ajustes → Ayuda y soporte» para todos (solo lo ven los propietarios), que los favoritos son públicos (no lo son) y que se recogen logs de crashes (no hay monitorización). La FAQ (`app/support.tsx`) dice «No compartimos tus datos personales con terceros sin tu consentimiento», lo que no es exacto con AdMob y los proveedores. La versión publicada en Notion no se ha podido leer. | Abierto. Borrador en `docs/audit/politica-privacidad-borrador.md`. 👤 Completar los datos del responsable, revisarlo (a ser posible con un asesor), publicarlo y sustituir los HTML antiguos. Ajustar el texto de la FAQ (área 03). |
| 11-H5 | 🔴 | **UGC sin reporte de reseñas o posts ni bloqueo de usuarios (Apple 1.2).** Solo existe «Reportar información» del bar. Apple pide, para contenido generado por usuarios, filtrar contenido, reportarlo, **bloquear usuarios abusivos** y un contacto publicado. Los términos (Notion) deben incluir tolerancia cero (⚠️ no verificado). | Abierto. El reporte de reseñas lo implementa el **área 03**. El **bloqueo de usuarios** (ocultar reseñas de un usuario bloqueado) no tiene dueño: 👤 decidir si lo hace el área 03 o una PR aparte. Moderación: hay `admin_delete_bar_review`. |
| 11-H6 | 🟠 | **Google Play exige una URL web para pedir el borrado de la cuenta** sin reinstalar la app. No existe. | Abierto. 👤 Publicar una página (puede ser una sección de la política: borrador, apartado 9) y declararla en Play Console › Seguridad de los datos. |
| 11-H7 | 🟠 | **Emails de contacto inconsistentes y sin verificar:** la app muestra `support@matchmap.com` (`app/contact-support.tsx`) y la política `privacy@matchmap.app`. ⚠️ Comprobar que esos dominios y buzones existen. Apple y Google publican el email de contacto de la ficha. | Abierto. 👤 Elegir un único buzón real (sirve el mismo para soporte y privacidad) y usarlo en la app, la política y las fichas. |
| 11-H8 | 🟠 | **Clasificación por edades y bares de apuestas.** La app no ofrece apuestas ni juego con dinero real; enseña locales (`is_betting_venue`) solo a quien se autodeclara mayor de edad y los oculta por defecto. Aun así: (a) los cuestionarios de Apple y de IARC preguntan por juego y por referencias al alcohol (son bares); (b) en España las comunicaciones comerciales de actividades de juego están reguladas (Real Decreto 958/2020), y destacar un local de apuestas podría entrar ahí. | Abierto. ⚠️ Propuesta para el cuestionario: «juego/apuestas simulados» = No; «juego con dinero real» = No; «alcohol, tabaco o drogas» = referencias infrecuentes o leves. Valorar una edad mínima alta y el público objetivo 18+ en Play para cubrir el contenido de apuestas. ⚠️ Lo de (b) depende de la jurisdicción: consultarlo con un asesor legal antes de destacar locales de apuestas (p. ej. con Boost). |
| 11-H9 | 🟠 | **Mapbox recibe ubicación y no se declaraba.** El SDK `@rnmapbox/maps` tiene la telemetría activa por defecto (envía a Mapbox datos de uso y de ubicación) y no hay `setTelemetryEnabled(false)` en el código. Además, la API Directions recibe las coordenadas de origen del usuario al pedir una ruta. | Abierto (fuera del código de anuncios). Recomendación: añadir `MapboxGL.setTelemetryEnabled(false)` junto a `setAccessToken` en `components/Map.tsx` (área 03/09), lo que simplifica las etiquetas. Si no, declararlo como hace la propuesta de cuestionarios. |
| 11-H10 | 🟡 | **Privacy manifest no versionado.** Se genera al hacer `pod install` (agregación activada) y los SDKs aportan el suyo; no hay `ios.privacyManifests` en `app.json`. | Abierto. 👤 Con el primer archive de EAS: Xcode › Organizer › *Generate Privacy Report* y comprobar que no falta ninguna razón (si falta, área 10 añade `ios.privacyManifests` en `app.json`). |
| 11-H11 | 🟡 | **El contacto de soporte solo lo ven los propietarios** (`ProfileScreen`: «Soporte y Tickets» solo si `userBars.length > 0`). Los usuarios normales solo tienen la FAQ. Apple 1.2 pide un contacto accesible para reportar abusos. | Abierto (área 03): mostrar el contacto a todos o poner el email en la FAQ. |
| 11-H12 | 🟡 | **Usuarios invitados anónimos sin limpieza.** No hay borrado de sesiones anónimas antiguas. Solo tienen un UUID, pero conviene fijar un plazo de conservación (p. ej. borrar las que tengan más de 30 días sin actividad). | Abierto (área 07, cron). |
| 11-H13 | 🟡 | **El borrado de cuenta no borra al cliente en RevenueCat** (`appUserID` = UUID de Supabase). Puede justificarse por obligaciones contables, pero la política debe decirlo. Opcional: llamar a la API de RevenueCat (`DELETE /subscribers/{id}`) desde `delete-user-account`. | Abierto (área 02/05). Ya se recoge en el borrador de la política. |
| 11-H14 | 🟡 | `user_pre_registrations` (emails de preinscripción web con inserción anónima) y la tabla legacy `auth_errors` no están en la política. | Abierto. 👤 Comprobar en prod si siguen en uso; si no, borrarlas (área 01/07). |

## Pendientes para ti (paneles)
1. **AdMob › Privacidad y mensajes:** confirmar que hay un mensaje RGPD publicado para la app iOS y Android (sin él, `gatherConsent` no muestra nada en el EEE) y, si se quiere, el mensaje explicativo de IDFA. Probar en un dispositivo desde España: primero el formulario de UMP y después ATT; Perfil › «Privacidad de anuncios» abre el formulario.
2. **Política de privacidad:** completar el borrador (responsable, NIF, dirección, email), publicarlo y poner su URL en App Store Connect, en Play Console y en la app (área 03 o 10, si cambia la URL de Notion).
3. **Términos:** comprobar que los de Notion incluyen normas de contenido y tolerancia cero.
4. **App Store Connect:** etiqueta de privacidad (propuesta arriba), clasificación por edades (11-H8), URL de soporte y de privacidad, notas para el revisor y cuenta demo (D6).
5. **Play Console:** Seguridad de los datos, URL de borrado de cuenta (11-H6), declaración de anuncios e ID de publicidad, público objetivo, cuestionario IARC.
6. **Decidir** quién implementa el bloqueo de usuarios (11-H5) y si se desactiva la telemetría de Mapbox (11-H9).
7. **Email único** de contacto (11-H7).

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=11, nombre=cumplimiento-legal]
Específico del área: inventaría todos los datos que la app recoge leyendo el código (tablas de
Supabase, SDKs en package.json, permisos) y genera en este fichero una tabla «dato → para qué → con
quién se comparte → se puede borrar», que servirá para la etiqueta de Apple, Data safety y la política
de privacidad (docs/legal y privacy/). Comprueba UMP/ATT en utils/ads.ts y contexts/AdsContext.tsx y
el privacy manifest. Redacta borradores de ficha de tienda en docs/audit/store-listing.md.
```

## Registro

### 2026-10-15 · Área 11 · Consentimiento de anuncios (UMP/ATT) y documentación legal
- **Tipo:** código
- **Qué:** los banners de AdMob no se montan hasta que el consentimiento UMP está resuelto y el SDK inicializado (`useAds().adsReady`); nueva fila «Privacidad de anuncios» en Perfil para revisar o retirar el consentimiento (formulario de opciones de privacidad de UMP); ATT espera a que la app esté activa. Inventario de datos, propuesta de etiqueta de Apple y de *Data safety*, borrador de política de privacidad (`docs/audit/politica-privacidad-borrador.md`) y de ficha de tienda (`docs/audit/store-listing.md`).
- **Por qué:** 11-H1 (🔴), 11-H2 (🟠), 11-H3 (🟠); HALLAZGOS #22.
- **Dónde:** rama `audit/11-cumplimiento-legal` (PR contra `main`, depende de la PR #34). Ficheros: `utils/ads.ts`, `contexts/AdsContext.tsx`, `components/ads/AdBanner.tsx`, `screens/ProfileScreen.tsx` y sus tests.
- **Verificación:** `npm ci`; `npm run typecheck` sin errores; `npm run lint`: ESLint 0 errores (241 warnings, todas del patrón ya existente) y `prettier -c` falla en 144 ficheros que ya estaban sin formatear (los ficheros nuevos y modificados de anuncios sí cumplen, salvo `ProfileScreen.tsx`, que ya estaba sin formatear antes); `npm test`: 49 suites / 517 tests en verde (en una primera pasada falló `write-review.test.tsx` de forma intermitente; pasa sola y en la segunda ejecución completa); `npm run test:functions`: 39 tests Deno en verde. Pendiente: prueba en dispositivo con el formulario de UMP (EEE) y ATT.
- **Rollback:** revertir el commit `audit(11): banners solo tras el consentimiento UMP…`. Sin migraciones ni cambios en paneles.
- **Quién:** ☁️ nube.
