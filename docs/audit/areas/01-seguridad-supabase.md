# 01 · Seguridad Supabase (RLS, Storage, invitados)

**Prioridad:** 🔴 · **Ejecución:** ☁️ escribe la migración y los tests → 💻 la aplica en prod con tu aprobación · **Rama:** `audit/01-seguridad-supabase`

## Objetivo
Que ningún usuario (invitado anónimo, usuario normal o propietario) pueda leer o modificar datos que no le corresponden, ni a través de la app ni llamando directamente a la API REST de Supabase.

## Alcance
`supabase/migrations/`, políticas de `public.*` y `storage.objects`, funciones `SECURITY DEFINER` y los puntos de la app que suben ficheros: `screens/EditProfileScreen.tsx`, `screens/registerBar/Step4Photos.tsx`, `app/create-post/[barId].tsx`, `app/edit-post/[postId].tsx`, `app/edit-bar-info/[barId].tsx`, `app/claim-bar/[barId].tsx`.

## Checklist
- [ ] **Storage (HALLAZGOS #1):** borrar `Allow read`, `Allow read access to objects`, `Allow insert for authenticated users`, `Allow upload`, `Users can update bar images`, `Users can delete bar images`. Crear políticas por bucket:
  - [ ] `bar-images`: lectura pública; escritura/borrado solo si el primer segmento de la ruta es un bar con `owner_id = auth.uid()` o super admin. Comprobar antes **qué rutas** usa cada pantalla de subida.
  - [ ] `avatars`: escritura solo en la carpeta `auth.uid()`.
  - [ ] `bar-claim-documents` (privado): solo el autor y admins (mantener las `*_own_or_admin`).
  - [ ] Bloquear cualquier escritura de sesiones anónimas (`(auth.jwt()->>'is_anonymous')::boolean`).
- [ ] **`bars` (HALLAZGOS #2):** borrar `Bar owner: update own bar` y `Bar owner: delete own bar`; trigger `BEFORE UPDATE` que proteja `verification_status`, `verified_*`, `rating`, `review_count`, `owner_id`, `is_test`, `is_betting_venue` salvo super admin (mismo patrón que `trg_users_protect_privileged_columns`).
- [ ] **Políticas legacy (HALLAZGOS #3):** borrar `Reviews: Insert by authenticated users`, `Reviews: Update own`, `Reviews: Delete own`, `Favorites: Self insert/read/delete` (si hay equivalente nuevo), `Bar owner: insert own bar`, y revisar los pares duplicados en `bar_images`, `bar_menus`, `bar_food_types`, `bar_languages`, `bar_selected_features`.
- [ ] **Invitados (HALLAZGOS #4):** políticas `RESTRICTIVE` "No anonymous" en `bar_reports`, `bar_claims`, `bar_requests`, `support_tickets`, `review_likes`, y comprobación de `is_anonymous` en `fn_claim_scarf` (o borrarla según D3). La UI debe pedir registro en esas acciones.
- [ ] **Recorrido completo de RLS:** listar todas las tablas de `public` con RLS desactivado o sin políticas; cualquier tabla con datos personales (users, support_tickets, bar_claims…) debe tener lectura restringida al dueño o admin.
- [ ] **`SECURITY DEFINER` (HALLAZGOS #11):** `REVOKE EXECUTE … FROM anon` en las 23 funciones y de `authenticated` en las que son triggers.
- [ ] **Límites de buckets (HALLAZGOS #13):** `file_size_limit` 5 MB y `allowed_mime_types` `image/jpeg,image/png,image/webp` en `avatars` y `bar-images`.
- [ ] **Claves:** confirmar que la app solo usa la *anon/publishable key* y que la `service_role` no aparece en el repo, en `eas.json` ni en el bundle (`grep -r service_role`).
- [ ] **Tests de RLS:** script SQL (`supabase/tests/rls_*.sql` con pgTAP o bloque `DO` con `set local role` + `request.jwt.claims`) que pruebe como anónimo, usuario A, usuario B, propietario y admin. Debe poder ejecutarse en prod en modo solo lectura/rollback.

## Criterios de aceptación
- Como invitado: no se pueden listar ni descargar objetos de `bar-claim-documents`, ni subir a ningún bucket, ni insertar en las tablas del punto 4.
- Como propietario: `PATCH /rest/v1/bars?id=eq.X` con `verification_status=approved` falla.
- Como usuario: no se puede reseñar ni marcar como favorito un bar no aprobado.
- La app sigue subiendo avatar, fotos de bar, posts y documentos de reclamación (probado en simulador tras aplicar).
- Advisors de seguridad de Supabase sin errores nuevos.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| 01-H1 | 🔴 | **Fuga de datos personales.** `Users can view profiles` era `SELECT USING (true)` para `authenticated`, rol que también tienen los invitados. Comprobado en prod en transacción de solo lectura como invitado: 122 filas y 122 emails visibles. | ✅ `20261105212402_audit01b_users_privacy.sql` aplicada en prod el 2026-11-05; invitado: 0 filas |
| 01-H2 | 🔴 | **Escalado a super admin.** `Allow insert during registration` era `INSERT WITH CHECK (true)` para `public`, y `trg_users_protect_privileged_columns` solo cubre UPDATE. Un invitado obtiene `is_super_user` creando su fila con el rol `anon`; un usuario normal, borrando y recreando la suya. Reproducido en PGlite, no en prod. | ✅ misma migración; `rls_01b_usuarios.sql` en prod con ROLLBACK: OK |
| 01-H3 | 🔴 | **Robo de bares pre-registrados.** El mismo INSERT con un email falso dispara `match_pre_registered_bar`. Deducido de las definiciones, no reproducido. | ✅ misma migración; `rls_01b_usuarios.sql` en prod con ROLLBACK: OK |
| 01-H4 | 🟠 | Protección de contraseñas filtradas desactivada en Supabase Auth. | ⏳ 👤 panel |
| 01-H5 | 🟠 | Postgres `17.4.1.048` con parches de seguridad pendientes. | ⏳ 👤 panel, con reinicio |
| 01-H7 | 🔴 | **Prod caído: toda la API responde 402** (`exceed_storage_size_quota`): REST, Auth, Storage y Functions. Plan free (1 GB) con 6,2 GB en `bar-images`, de ellos 4,1 GB en `scraped/`. Los crons figuran `succeeded` en `cron.job_run_details`, pero sus llamadas HTTP devuelven 402: no sincronizan partidos ni envían avisos. | ✅ Resuelto el 2026-11-15: proyecto pasado a Supabase Pro; la API vuelve a responder (HTTP 200). |
| 01-H6 | 🟡 | `is_super_admin()` e `is_support_admin()` ejecutables por `anon`. Solo devuelven `false` sin sesión. | Anotado |
| 01-H8 | 🔴 | **Pagos de Boost visibles para cualquiera.** La política `Allow all authenticated users to view active boosts` de `bar_boosts` era `USING (true)`, a pesar del nombre: cualquier sesión, también la de un invitado, lee `user_id`, `amount_cents`, `currency` y `revenuecat_transaction_id` de todas las compras (5 filas en prod). | 🛠 `20261115120000_audit01c_bar_boosts_privacy.sql`: solo boosts `active` para los demás, sin columnas de pago y sin permisos para `anon`; 5 tests en `rls_01c_bar_boosts.test.ts`. **Pendiente de aplicar en prod** |
| 01-H9 | 🟡 | El bucket `ticket-claims` (fotos de entradas de la función de bufandas, 7 ficheros) es público: quien tenga la URL ve la imagen. No se puede listar ni subir desde el cliente. | Se resuelve con D3 (borrar la función) o pasándolo a privado |
| 01-H10 | 🟡 | `bar_pre_registrations` y `user_pre_registrations` aceptan `INSERT` de `anon` con `WITH CHECK (true)`; no se pueden leer. Riesgo de spam, no de fuga. | Anotado |
| 01-H11 | 🟢 | Repaso del 2026-11-15 contra prod: las 47 tablas de `public` tienen RLS; las políticas «No anonymous» son `RESTRICTIVE`; `trg_users_protect_privileged_columns` y `trg_bars_protect_privileged_columns` protegen las columnas de rol y verificación; las funciones `SECURITY DEFINER` peligrosas (`delete_user_data`, `get_cron_secret`, `invoke_cron_function`, `upsert_match_from_sync`, `promote_pre_registered_bar`…) no son ejecutables por `anon` ni `authenticated`, y las de admin comprueban `is_super_admin()`. La vista `public_profiles` (`SECURITY DEFINER`) solo expone `id`, `username` y avatar de quien ha publicado reseña, como se diseñó en 01b. | ✅ Sin acción |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=01, nombre=seguridad-supabase]
Específico del área: no tienes acceso a prod. Reconstruye el estado actual de políticas a partir de
supabase/migrations y de HALLAZGOS_2026-10-10.md (que lista los nombres reales en prod). Escribe UNA
migración idempotente (DROP POLICY IF EXISTS…) y un script de pruebas de RLS. Antes de restringir
Storage, documenta en el fichero del área la ruta exacta que usa cada pantalla de subida y asegúrate
de que las políticas nuevas la permiten. Si alguna pantalla sube a una ruta que no encaja con el
patrón por propietario, cambia la pantalla y añade test.
```
