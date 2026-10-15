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
| | | | |

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
