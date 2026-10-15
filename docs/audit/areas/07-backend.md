# 07 · Backend: edge functions, crons y migraciones

**Prioridad:** 🟠 · **Ejecución:** ☁️ código y tests · 💻 prod · **Rama:** `audit/07-backend`

## Objetivo
Que el backend sea reproducible desde el repo, que las tareas programadas funcionen solas y que un fallo se note.

## Alcance
`supabase/functions/*` (`delete-user-account`, `promote_pre_registered_bar_with_images`, `revenuecat-webhook`, `send-match-notifications`, `sync-football`), `supabase/migrations/` (51), crons `sync-football-daily` (06:00 UTC) y `send-match-notifications` (`*/15`) en pg_cron + pg_net, secreto en Vault (`get_cron_secret`).

## Checklist
- [ ] **Migraciones repo == prod:** comparar `supabase/migrations` con `supabase_migrations.schema_migrations` de prod. Única diferencia conocida: `20260518000000_drop_scarves_collectibles` (D3). Resolverla. → 💻 T1 (consulta abajo). La nueva `20261020000000_perf_…` también estará solo en el repo hasta aplicarla.
- [ ] **Edge functions desplegadas == repo:** versión y hash de cada una; `verify_jwt` correcto (solo el webhook va sin JWT y valida su secreto). → Repo revisado: `revenuecat-webhook`, `sync-football` y `send-match-notifications` van con `verify_jwt = false` y validan su secreto; `delete-user-account` y `promote_pre_registered_bar_with_images` ahora declaran `verify_jwt = true` en `config.toml` (07-H9). Falta 💻 T2 (comparar con prod y redesplegar).
- [x] **Validación de entrada** en cada función (body malformado → 400, no 500) y sin filtrar errores internos al cliente. → Arreglado en `promote_pre_registered_bar_with_images` (07-H2), `revenuecat-webhook` (405/400 genérico) y `sync-football` (`leagueId`, 07-H10). `delete-user-account` ya lo cumplía.
- [ ] **Secretos:** listar los que usa cada función y confirmar que existen en prod (API-Football, RevenueCat, Expo push). → Lista hecha (tabla abajo). Falta 💻 T3 (confirmar en prod).
- [ ] **API-Football:** confirmar que el plan cubre la temporada actual (el plan gratuito no permitía 2026); hay partidos futuros cargados y el sync diario no falla. → 💻 T4.
- [ ] **Crons:** última ejecución correcta en `cron.job_run_details`; alerta o al menos consulta documentada para ver fallos. → Consultas documentadas (T5). Ojo: `job_run_details` no ve los fallos de la función (07-H1). Falta 💻 ejecutarlas en prod.
- [ ] **Postgres (HALLAZGOS #10):** aplicar el parche de seguridad pendiente fuera de horario de partidos. → 💻/👤 T6.
- [ ] **Rendimiento BD (HALLAZGOS #21):** `(select auth.uid())` en políticas, índice duplicado, índice sin uso, FK sin índice. → Migración escrita (`20261020000000_perf_rls_initplan_and_fk_indexes.sql`, 07-H17). Falta 💻 T7 (aplicar tras la del área 01) y decidir el índice sin uso.
- [ ] **Copias de seguridad:** confirmar plan de backups/PITR de Supabase y documentar cómo restaurar. → Procedimiento documentado (runbook). Falta 👤 T8 (confirmar plan).
- [x] Tests Deno de las funciones (`npm run test:functions`) en verde y cubriendo los casos nuevos. → 39 → 63 tests Deno (nuevos: `revenuecat-webhook/handler.test.ts`, `_shared/secrets.test.ts` y casos en el resto) + 3 tests Jest de `getAmount`.

## Criterios de aceptación
- `supabase db diff` contra prod sin diferencias inesperadas. → 💻 T1.
- Runbook corto en este fichero: qué hacer si falla el sync, el webhook o el cron de notificaciones. → ✅ sección *Runbook*.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| 07-H1 | 🟠 | `cron.job_run_details` solo registra que `net.http_post` se **encoló**: si la edge function devuelve 401/500 o hace timeout, el job sale `succeeded` igual. Además `sync-football` devolvía 200 aunque fallasen **todas** las competiciones (p. ej. plan de API-Football sin la temporada), así que un sync roto era invisible. | ✅ `sync-football` devuelve 502 y `success:false` si fallan todas (test). Consulta de `net._http_response` en T5. Alerta automática: pendiente (opcional, 💻). |
| 07-H2 | 🟠 | `promote_pre_registered_bar_with_images`: body malformado → 500; las respuestas devolvían mensajes internos de Postgres/PostgREST (`preBarErr.message`, `rpcErr.message`, `details: String(err)`, `rpcData`) y sin `Content-Type`. | ✅ 400 con body inválido o tipos incorrectos, mensajes genéricos, `Content-Type: application/json` (tests). El cliente (`utils/auth.ts`) no depende del texto del error. |
| 07-H3 | 🟠 | `revenuecat-webhook` sin tests del handler (solo la lógica pura en Jest): idempotencia, 401, 400 y reintentos de pago sin cubrir. | ✅ Lógica movida a `handler.ts` (`index.ts` solo la monta) y 14 tests Deno. |
| 07-H4 | 🟠 | `revenuecat-webhook`: un reintento tardío de `NON_RENEWING_PURCHASE` reactivaba un boost ya `cancelled` (reembolso) o `expired`, porque solo se saltaba si estaba `active`. | ✅ Solo se activa una fila nueva o `pending` (test). |
| 07-H5 | 🟡 | `revenuecat-webhook` guardaba `amount_cents` con `price` (RevenueCat lo envía en USD) junto a `currency` local → importes incoherentes. | ✅ `getAmount`: usa `price_in_purchased_currency` + `currency`; si falta, `price` en `usd` (tests Jest). |
| 07-H6 | 🟡 | Comparación de secretos (`x-cron-secret`, `Authorization` del webhook) con `===`, no en tiempo constante. | ✅ `_shared/secrets.ts` (`timingSafeEqual`). |
| 07-H7 | 🟡 | El `cron_secret` se cacheaba por instancia sin relectura: si se rota en Vault, la función devuelve 401 hasta un arranque en frío. | ✅ `createCronAuth` relee el secreto al fallar (máx. 1 vez/min, para que un secreto falso no provoque una RPC por petición). |
| 07-H8 | 🟠 | `send-match-notifications` escribía el token push (`ExponentPushToken[…]`) en los logs de error (regla: nada de datos personales en logs). | ✅ Se registra `push_token_id` y `details.error` (test). |
| 07-H9 | 🟠 | `supabase/config.toml` no declaraba `delete-user-account` ni `promote_pre_registered_bar_with_images`: su `verify_jwt` dependía de cómo se desplegaron a mano. | ✅ Declaradas con `verify_jwt = true`. 💻 T2: confirmar en prod. |
| 07-H10 | 🟡 | `sync-football`: `?leagueId=abc` hacía la consulta con `NaN` → 500. | ✅ 400 si no es un entero positivo (test). |
| 07-H11 | 🟡 | Imports sin fijar: `esm.sh/@supabase/supabase-js@2` (cada despliegue puede empaquetar otra versión) y `std@0.168.0/http/server.ts` (`serve` obsoleto; las funciones nuevas usan `Deno.serve`). El despliegue no es 100 % reproducible. | Pendiente (post-lanzamiento): fijar versión exacta y migrar a `Deno.serve`, probándolo con `supabase functions serve`. |
| 07-H12 | 🟡 | `promote_pre_registered_bar_with_images` no es idempotente a medias: si se corta a mitad de mover imágenes, el reintento ve que ya hay imágenes y devuelve `alreadyConverted`, dejando el resto sin migrar. | Pendiente. Muy raro (solo bares pre-registrados). |
| 07-H13 | 🟡 | `delete-user-account`: `storage.list` con `limit: 1000` sin paginar (bares con >1000 ficheros dejarían restos); si falla `auth.admin.deleteUser` tras `delete_user_data`, el usuario queda sin datos pero con cuenta (se puede reintentar). Contrato con el cliente sin cambios. | Pendiente; coordinar con área 02 si se cambia el contrato. |
| 07-H14 | 🟡 | `send-match-notifications` no consulta los *receipts* de Expo (algunos `DeviceNotRegistered` solo llegan ahí) ni usa `EXPO_ACCESS_TOKEN` (necesario si se activa *Enhanced Security for Push* en Expo). | Pendiente (área 06). |
| 07-H15 | 🟡 | `revenuecat-webhook` no distingue `event.environment` (`SANDBOX`/`PRODUCTION`): compras sandbox (TestFlight, revisores de Apple) activan boosts en la BD de prod. Útil para la revisión, pero mezcla datos. | Decisión 👤 (área 05). |
| 07-H16 | 🟡 | `sync-football`: `SEASON = '2026'` fijo como respaldo; cada competición usa `api_football_season`, que hay que actualizar a mano cada temporada. | Anotado en el runbook. |
| 07-H17 | 🟠 | HALLAZGOS #21: políticas con `auth.uid()` sin `(select …)`, índice duplicado, FK sin índice, índice sin uso. | ✅ Migración `20261020000000_perf_rls_initplan_and_fk_indexes.sql` (genérica e idempotente; probada 2 veces seguidas sobre Postgres embebido con políticas, índices y FKs de ejemplo). El índice sin uso **no** se borra (ver T7). 💻 aplicar después de la del área 01. |
| 07-H18 | 🟡 | `npm run lint` ya fallaba en `main` por `prettier -c` (146 ficheros, incluidos los de `supabase/functions`). Los ficheros nuevos de esta PR están formateados; el resto no se toca para no inflar el diff. | Área 08. |

### Secretos que usa cada función
| Función | Variables de entorno | Otros |
|---|---|---|
| `delete-user-account` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (las inyecta Supabase) | JWT del usuario |
| `promote_pre_registered_bar_with_images` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | JWT del usuario |
| `revenuecat-webhook` | `REVENUECAT_WEBHOOK_SECRET` (valor completo de la cabecera `Authorization` configurada en RevenueCat), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Sin el secreto responde 401 a todo |
| `send-match-notifications` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `cron_secret` en Vault (`get_cron_secret`). No usa `EXPO_ACCESS_TOKEN` (07-H14) |
| `sync-football` | `API_FOOTBALL_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `cron_secret` en Vault |

### Tareas 💻 en prod (sesión local, con aprobación)
**T1 · Migraciones repo vs prod**
```sql
select version, name from supabase_migrations.schema_migrations order by version;
```
Comparar con `ls supabase/migrations` (o `supabase migration list --linked`). Esperado: solo faltan `20260518000000_drop_scarves_collectibles` (D3) y `20261020000000_perf_rls_initplan_and_fk_indexes` (hasta aplicarla). **No** usar `supabase db push` en bloque mientras exista la de D3. Después: `supabase db diff --linked --schema public` sin diferencias inesperadas.

**T2 · Edge functions desplegadas**
`supabase functions list` (o MCP `list_edge_functions`): anotar `version`, `verify_jwt` y `ezbr_sha256`. Esperado `verify_jwt`: `false` en `revenuecat-webhook`, `sync-football`, `send-match-notifications`; `true` en `delete-user-account` y `promote_pre_registered_bar_with_images`. Tras mergear, redesplegar desde el repo (respeta `config.toml`):
```bash
supabase functions deploy revenuecat-webhook sync-football send-match-notifications promote_pre_registered_bar_with_images delete-user-account
```
Comprobar después: webhook → evento *Test* desde RevenueCat (200 `ignored: TEST`); sync → `select public.invoke_cron_function('sync-football', 150000);` y mirar `net._http_response` (T5).

**T3 · Secretos**
`supabase secrets list`: deben existir `API_FOOTBALL_KEY` y `REVENUECAT_WEBHOOK_SECRET`. Vault:
```sql
select name, created_at, updated_at from vault.secrets where name = 'cron_secret';
```

**T4 · API-Football**
```sql
select c.name, c.api_football_id, c.api_football_season,
       count(m.id) filter (where m.datetime_utc > now()) as futuros,
       max(m.datetime_utc) as ultimo_partido
from public.competitions c
left join public.matches m on m.competition_id = c.id
where c.api_football_id is not null
group by 1, 2, 3
order by futuros asc;
```
Competiciones con `futuros = 0` en plena temporada = sync roto para esa liga. Plan de la cuenta (local, sin pegar la clave en ningún sitio): `curl -s -H "x-apisports-key: $API_FOOTBALL_KEY" https://v3.football.api-sports.io/status`.

**T5 · Crons** (estado de los jobs y respuesta HTTP real de las funciones)
```sql
-- Último OK y fallos de las últimas 24 h por job (solo ve el encolado del http_post)
select j.jobname, j.schedule, j.active,
       max(d.end_time) filter (where d.status = 'succeeded') as ultimo_ok,
       count(*) filter (where d.status = 'failed' and d.start_time > now() - interval '24 hours') as fallos_24h
from cron.job j
left join cron.job_run_details d using (jobid)
group by 1, 2, 3;

-- Respuesta real de las edge functions (pg_net la guarda ~6 h)
select id, created, status_code, timed_out, error_msg, left(content::text, 300) as cuerpo
from net._http_response
order by created desc
limit 30;
```
Cualquier `status_code` ≠ 200, `timed_out = true` o `error_msg` no nulo es un fallo. `sync-football` corre a las 06:00 UTC: mirar antes de las 12:00 UTC o lanzarlo a mano.

**T6 · Parche de Postgres (HALLAZGOS #10)**
`select version();` y advisor `vulnerable_postgres_version`. Actualizar en *Settings › Infrastructure* un día sin partidos y fuera de 06:00 UTC (sync). Tras actualizar: T5 y una búsqueda de bares en la app. Ojo: el reinicio pone a cero `pg_stat_user_indexes` (afecta a T7).

**T7 · Migración de rendimiento (HALLAZGOS #21)**
1. Aplicar antes la migración de seguridad del área 01.
2. Ensayo: ejecutar el fichero entre `begin;` y `rollback;` y revisar los `NOTICE` (qué políticas se reescriben, qué índice se borra, qué índices se crean).
3. Aplicar (MCP `apply_migration` con el mismo nombre) y repetir los advisors de rendimiento: `auth_rls_initplan`, `duplicate_index` y `unindexed_foreign_keys` deben desaparecer.
4. Índice sin uso (no incluido; decidir con datos de uso de al menos 1–2 semanas tras el lanzamiento):
```sql
select s.relname as tabla, s.indexrelname as indice, s.idx_scan,
       pg_size_pretty(pg_relation_size(s.indexrelid)) as tamano
from pg_stat_user_indexes s
join pg_index i using (indexrelid)
where s.schemaname = 'public' and s.idx_scan = 0 and not i.indisunique
  and not exists (select 1 from pg_constraint c where c.conindid = s.indexrelid)
order by pg_relation_size(s.indexrelid) desc;
```
Rollback: las políticas reescritas son equivalentes (no hace falta deshacer); los índices creados se borran con `drop index`; el índice duplicado borrado se recrea con el `indexdef` que aparece en el `NOTICE`.

**T8 · Copias de seguridad (👤)**
*Database › Backups*: el plan Free no ofrece backups descargables; Pro guarda 7 días de backups diarios y PITR es un add-on. Confirmar plan y anotar aquí. Ver *Runbook › Restaurar*.

## Runbook
**Falla el sync de fútbol** (no hay partidos nuevos, `futuros = 0` en T4 o `status_code` 502/500/401 en `net._http_response`):
1. Logs de la función: *Edge Functions › sync-football › Logs* (o MCP `get_logs` servicio `edge-function`). El cuerpo de la respuesta trae `results[].error` por competición.
2. `HTTP 401/403` o `errors.token` → `API_FOOTBALL_KEY` caducada: renovarla y `supabase secrets set API_FOOTBALL_KEY=…`.
3. `errors.plan` / *Free plans do not have access to this season* → el plan no cubre la temporada: subir plan o cambiar `competitions.api_football_season`.
4. `errors.requests` → límite diario: reintentar al día siguiente o solo una liga: `select net.http_post(url := 'https://hmtfxpihkoisncglllmq.supabase.co/functions/v1/sync-football?leagueId=140', headers := jsonb_build_object('x-cron-secret', public.get_cron_secret()), timeout_milliseconds := 150000);`
5. `401 Unauthorized` de la función → `cron_secret` de Vault ilegible o la función desplegada con `verify_jwt = true`: revisar T2/T3.
6. `timed_out` → demasiadas ligas en 150 s: lanzar por `leagueId`.
7. Cambio de temporada (julio/agosto): actualizar `competitions.api_football_season` (07-H16).

**Falla el webhook de RevenueCat** (boost pagado que no se activa):
1. RevenueCat › *Integrations › Webhooks* › historial: código de respuesta.
2. `401` → `REVENUECAT_WEBHOOK_SECRET` no coincide con la cabecera configurada en RevenueCat, o la función se desplegó con `verify_jwt = true`. Corregir y reenviar el evento desde RevenueCat.
3. `500` → error de BD; RevenueCat reintenta solo. Ver logs de `revenuecat-webhook`.
4. `200` pero sin boost → mirar en logs `product_id desconocido` o `Sin bar para app_user_id` (falta el atributo `boost_bar_id`). Activar a mano como super admin con `fn_admin_gift_boost`.
5. Comprobar: `select status, plan, start_at, end_at from public.bar_boosts where revenuecat_transaction_id = '<tx>';`

**Falla el cron de notificaciones**:
1. T5: `status_code` de `send-match-notifications` (cada 15 min).
2. `500` con `fn_get_pending_match_notifications` → error SQL en la RPC (logs de Postgres).
3. `Expo Push API HTTP …` en logs → caída de Expo; el siguiente cron reintenta (los pares no enviados no se marcan).
4. Todo 200 pero no llegan → credenciales push (APNs/FCM, área 06) o tokens borrados por `DeviceNotRegistered` (`tokens_removed` en la respuesta).
5. Pausar si envía de más: `select cron.alter_job((select jobid from cron.job where jobname = 'send-match-notifications'), active := false);`

**Restaurar la BD**: *Database › Backups* → elegir backup diario (o PITR) → *Restore*. El proyecto queda sin servicio durante la restauración y se pierden los cambios posteriores al punto elegido. Después: T1 (migraciones), T2 (las edge functions no se restauran: redesplegar desde el repo), T3 (Vault se restaura con la BD; los secretos de funciones no cambian) y T5.

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=07, nombre=backend]
Específico del área: audita supabase/functions (validación, errores, idempotencia, secretos usados) y
añade tests Deno donde falten. Escribe la migración de rendimiento (HALLAZGOS #21) como fichero aparte.
Lo que requiera prod (comparar migraciones, versiones desplegadas, cron.job_run_details, parche de
Postgres) déjalo como tareas 💻 en Hallazgos con la consulta SQL exacta.
```

## Registro

### 2026-10-15 · Área 07 · Auditoría de edge functions, tests y migración de rendimiento
- **Tipo:** código
- **Qué:** `revenuecat-webhook` separado en `handler.ts` con tests, sin reactivar boosts reembolsados/caducados e importe en la moneda de compra; `_shared/secrets.ts` (comparación en tiempo constante y relectura del `cron_secret`) usado por `sync-football` y `send-match-notifications`; `sync-football` devuelve 502 si fallan todas las competiciones y 400 con `leagueId` inválido; `promote_pre_registered_bar_with_images` responde 400 con body malformado y no filtra errores internos; `send-match-notifications` deja de registrar tokens push; `config.toml` declara `verify_jwt = true` en `delete-user-account` y `promote_pre_registered_bar_with_images`; migración `20261020000000_perf_rls_initplan_and_fk_indexes.sql`; runbook y tareas de prod T1–T8 en este fichero.
- **Por qué:** 07-H1 a 07-H10 y 07-H17 (HALLAZGOS #21).
- **Dónde:** rama `audit/07-backend` (PR contra `main`, depende de la PR #34). **Requiere aplicar en prod:** migración (T7, después de la del área 01) y redespliegue de las 5 funciones (T2).
- **Verificación:** `npm run test:functions` (63 tests Deno, antes 39), Jest de `revenuecatWebhookLogic` (+3), `npm run typecheck`. Migración ejecutada dos veces seguidas sobre Postgres embebido (PGlite) con políticas, índices duplicados y FKs de ejemplo: resultado correcto e idempotente. `npm run lint` sigue fallando por el `prettier -c` previo de `main` (07-H18, área 08).
- **Rollback:** revertir el commit y redesplegar las funciones; migración: ver T7.
- **Quién:** ☁️ nube.
