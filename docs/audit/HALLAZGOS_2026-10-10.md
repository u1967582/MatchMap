# Auditoría pre-lanzamiento — 2026-10-10

Revisión de `origin/main` (`14d0003`) y del proyecto Supabase de producción (`hmtfxpihkoisncglllmq`).

Estado general: `tsc` sin errores, Jest 48 suites / 501 tests en verde, ESLint 0 errores (235 warnings), `expo-doctor` 18/18. Crons `sync-football-daily` y `send-match-notifications` activos (194 ejecuciones correctas en 48 h), 1220 partidos futuros cargados.

Leyenda: 🔴 bloqueante · 🟠 importante antes de lanzar · 🟡 mejora / deuda

---

## 🔴 Bloqueantes (seguridad y datos)

### 1. Storage: cualquier usuario (también invitado) puede leer, subir y borrar ficheros de todos los buckets
Políticas en `storage.objects`:
- `Allow read` y `Allow read access to objects` → `SELECT` para `authenticated` con `true`. Incluye el bucket **privado** `bar-claim-documents` (documentos que acreditan la titularidad del bar). Como el modo invitado crea una sesión anónima (`app/index.tsx` → `signInAnonymously`), cualquiera que instale la app puede descargar esos documentos. Hoy el bucket está vacío, pero en cuanto alguien reclame un bar habrá una fuga de datos personales (RGPD).
- `Allow insert for authenticated users` y `Allow upload` → `INSERT` con `true` en cualquier bucket.
- `Users can update bar images` / `Users can delete bar images` → cualquier sesión puede sobrescribir o borrar las 10 514 imágenes de `bar-images`.

**Arreglo:** borrar las políticas genéricas (`Allow read`, `Allow read access to objects`, `Allow insert for authenticated users`, `Allow upload`, `Users can update/delete bar images`) y crear políticas por bucket: `bar-images` escritura solo si el primer segmento de la ruta es un bar cuyo `owner_id = auth.uid()` (o super admin); `avatars` escritura solo en la carpeta `auth.uid()`; `bar-claim-documents` mantener las de `*_own_or_admin`. Bloquear escritura a sesiones anónimas (`auth.jwt()->>'is_anonymous'`). Revisar antes qué rutas usan `EditProfileScreen`, `create-post`, `edit-bar-info`, `bar-menu` y `register-bar` para no romper subidas.

### 2. Un propietario puede auto-aprobar su bar (y tocar rating, owner, is_test…)
La política `Bar owner: update own bar` (`UPDATE`, rol `public`) no tiene `WITH CHECK`. Al ser permisiva, se suma (OR) a `bars_update_owner_no_status_change`, así que la restricción de "no cambiar el estado" no sirve. Con una llamada REST el dueño puede poner `verification_status = 'approved'`, `rating`, `review_count`, `is_test`, `is_betting_venue` u `owner_id`. No hay trigger que lo impida (en `bars` solo hay `assign_bar_to_user_trigger` y `bars_force_pending_before_insert`).

**Arreglo:** borrar `Bar owner: update own bar` y `Bar owner: delete own bar` (duplicadas de las nuevas) y añadir un trigger `BEFORE UPDATE` que proteja `verification_status`, `verified_*`, `rating`, `review_count`, `owner_id`, `is_test`, `is_betting_venue` salvo para super admin (igual que `trg_users_protect_privileged_columns` en `users`).

### 3. Políticas permisivas antiguas anulan las restricciones nuevas
Mismo patrón (políticas legacy con rol `public` que se suman por OR):
- `reviews`: `Reviews: Insert by authenticated users` deja reseñar bares no aprobados (anula `reviews_insert_only_for_approved_bars`). Igual con `Reviews: Update own` / `Reviews: Delete own`.
- `favorites`: `Favorites: Self insert` anula `favorites_insert_only_for_approved_bars`.
- `bars`: `Bar owner: insert own bar` (`auth.uid() IS NOT NULL`) anula `bars_insert_owner_pending` (el estado se salva por el trigger `force_pending`, pero se puede crear un bar con `owner_id` de otra persona).
- `bar_images`, `bar_menus`, `bar_food_types`, `bar_languages`, `bar_selected_features`: hay pares "Bar owner: …" + "…_owner" duplicados; revisar que las antiguas no sean más laxas.

**Arreglo:** una migración que borre las políticas legacy y deje solo las nuevas. El advisor de rendimiento también marca `multiple_permissive_policies`.

### 4. Los invitados (sesión anónima) pueden escribir donde no deberían
Hay 76 usuarios anónimos en `auth.users`. Solo `reviews`, `favorites`, `bars` y `users` tienen la política restrictiva `No anonymous …`. Un invitado puede: crear `bar_reports`, `bar_claims`, `bar_requests`, `support_tickets`, `review_likes`, y llamar a `fn_claim_scarf` (comprueba `auth.uid() IS NULL`, que un anónimo pasa). Riesgo de spam y de reclamaciones falsas de bares.

**Arreglo:** añadir políticas `RESTRICTIVE` "No anonymous" en esas tablas (o comprobar `is_anonymous` dentro de las funciones) y que la UI pida registro.

---

## 🟠 Importante antes de lanzar

### Configuración de stores
5. **Bundle ID / package `com.tuorg.matchmap`** (`app.json`): es un placeholder. En iOS ya existe la app en App Store Connect con ese ID (cambiarlo implica app nueva). En Android, si aún no está publicada en Play, es el momento de cambiarlo (no se puede cambiar después). Decidir.
6. **Push en Android:** falta `googleServicesFile` / `google-services.json` (FCM). Sin ello las notificaciones de partidos no llegan en Android. Verificar también la clave APNs en EAS (`eas credentials`).
7. **Compra de Boost real sin probar:** falta una compra sandbox/TestFlight de punta a punta y revisar el paywall en dispositivo; confirmar en logs del webhook que no hay 401 (secreto de RevenueCat).
8. **URL de redirección de Supabase Auth:** comprobar que `matchmap://auth/reset-password` y `matchmap://auth/callback` están en *Redirect URLs* del proyecto; si no, el email de recuperación no abre la app en producción (`utils/auth.ts:801`).

### Supabase / Auth
9. **Protección de contraseñas filtradas desactivada** (advisor `auth_leaked_password_protection`) → activarla en Auth › Providers › Email.
10. **Postgres con parches de seguridad pendientes** (advisor `vulnerable_postgres_version`) → actualizar desde Settings › Infrastructure (fuera de horario de partidos).
11. **Funciones `SECURITY DEFINER` todavía ejecutables por `anon`:** 23 (`fn_admin_gift_boost`, `convert_scraped_bar`, `admin_delete_bar_review`, `fn_sync_bar_preferences_admin`, `fn_claim_scarf`, triggers…). Revisadas: todas comprueban `is_super_admin()`/`auth.uid()` o son triggers, así que no hay hueco explotable, pero conviene `REVOKE EXECUTE … FROM anon` (y de `authenticated` en los triggers) como defensa en profundidad.
12. **Migración `20260518000000_drop_scarves_collectibles`** sigue solo en el repo (destructiva). Decidir si se aplica o se borra, para que un `supabase db push` no la ejecute por sorpresa. Si se abandona la función de bufandas, borrar también `fn_claim_scarf`, `ticket_claims` y el bucket `ticket-claims` (público, 7 ficheros).
13. **Buckets sin límites:** `avatars` y `bar-images` no tienen `file_size_limit` ni `allowed_mime_types` → poner p. ej. 5 MB e `image/jpeg,png,webp`.

### Producto / contenido
14. **Pocos bares visibles:** 47 aprobados frente a 135 pendientes (182 en total). Revisar la cola de verificación antes de abrir al público.
15. **Monitorización de errores:** no hay Sentry ni Crashlytics. Sin ello no se ven los crashes de producción (alternativa sin cuenta nueva: EAS Observe / `expo-insights`).

---

## 🟡 Mejoras y deuda técnica

16. **Botón "Navegar" sin hacer nada:** `components/Map.tsx:303` `handleNavigateToBar` es un `TODO` vacío que se pasa a `BarInfoCard` como `onNavigate`. `BarInfoCard` no lo usa, así que no es visible; borrar la prop y el callback o implementarlo.
17. **389 `console.log`** en código de app. En producción se eliminan con `transform-remove-console` (`babel.config.js`), pero `console.error/warn` se mantienen y algunos incluyen emails (p. ej. `utils/auth.ts` en el reset de contraseña). Limpiar los que exponen datos.
18. **ESLint:** 235 warnings (imports no usados en `utils/auth.ts`, `import/first` en tests…); 108 con `--fix`.
19. **`eas.json`:** 9 perfiles con las mismas variables copiadas (`preview`, `preview2`, `preview3`, `preview4`, `preview-aab`…). Pasar las variables a *EAS Environment Variables* y borrar los perfiles que no se usen. `MAPBOX_DOWNLOADS_TOKEN` tiene un token público `pk.`; si el build de Android necesita token de descarga, tiene que ser un `sk.` secreto (en EAS Secrets, no en el repo).
20. **Android `intentFilters`:** `autoVerify: true` con el esquema `matchmap` no tiene efecto (solo aplica a http/https). Inofensivo, pero si se quieren App Links reales, hace falta dominio + `assetlinks.json`.
21. **Rendimiento BD (advisors):** `auth_rls_initplan` (usar `(select auth.uid())` en políticas), un índice duplicado, un índice sin uso y una FK sin índice.
22. **Política de privacidad (Notion):** comprobar que menciona AdMob (IDFA/ATT y consentimiento UMP), RevenueCat, Mapbox, ubicación, notificaciones push y el borrado de cuenta, y que coincide con la etiqueta de privacidad de App Store y el formulario *Data safety* de Play.
23. **Documentación:** `docs/` tiene muchos documentos de fixes antiguos (`docs/fixes`, `docs/auth`) que ya no reflejan el estado; archivar.

---

## Orden recomendado
1. Migración de seguridad: Storage (1) + `bars` (2) + políticas legacy (3) + anónimos (4). Probar subidas de imágenes, edición de bar, reseñas y favoritos en la app tras aplicarla.
2. Ajustes de Auth/Postgres del panel (9, 10) y límites de buckets (13).
3. Decisiones: bundle ID Android (5), bufandas (12).
4. FCM Android (6), compra sandbox (7), redirect URLs (8), monitorización (15).
5. Contenido: aprobar bares (14).
6. Deuda (16–23) después del lanzamiento.
