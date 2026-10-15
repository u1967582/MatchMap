# 07 · Backend: edge functions, crons y migraciones

**Prioridad:** 🟠 · **Ejecución:** ☁️ código y tests · 💻 prod · **Rama:** `audit/07-backend`

## Objetivo
Que el backend sea reproducible desde el repo, que las tareas programadas funcionen solas y que un fallo se note.

## Alcance
`supabase/functions/*` (`delete-user-account`, `promote_pre_registered_bar_with_images`, `revenuecat-webhook`, `send-match-notifications`, `sync-football`), `supabase/migrations/` (51), crons `sync-football-daily` (06:00 UTC) y `send-match-notifications` (`*/15`) en pg_cron + pg_net, secreto en Vault (`get_cron_secret`).

## Checklist
- [ ] **Migraciones repo == prod:** comparar `supabase/migrations` con `supabase_migrations.schema_migrations` de prod. Única diferencia conocida: `20260518000000_drop_scarves_collectibles` (D3). Resolverla.
- [ ] **Edge functions desplegadas == repo:** versión y hash de cada una; `verify_jwt` correcto (solo el webhook va sin JWT y valida su secreto).
- [ ] **Validación de entrada** en cada función (body malformado → 400, no 500) y sin filtrar errores internos al cliente.
- [ ] **Secretos:** listar los que usa cada función y confirmar que existen en prod (API-Football, RevenueCat, Expo push).
- [ ] **API-Football:** confirmar que el plan cubre la temporada actual (el plan gratuito no permitía 2026); hay partidos futuros cargados y el sync diario no falla.
- [ ] **Crons:** última ejecución correcta en `cron.job_run_details`; alerta o al menos consulta documentada para ver fallos.
- [ ] **Postgres (HALLAZGOS #10):** aplicar el parche de seguridad pendiente fuera de horario de partidos.
- [ ] **Rendimiento BD (HALLAZGOS #21):** `(select auth.uid())` en políticas, índice duplicado, índice sin uso, FK sin índice.
- [ ] **Copias de seguridad:** confirmar plan de backups/PITR de Supabase y documentar cómo restaurar.
- [ ] Tests Deno de las funciones (`npm run test:functions`) en verde y cubriendo los casos nuevos.

## Criterios de aceptación
- `supabase db diff` contra prod sin diferencias inesperadas.
- Runbook corto en este fichero: qué hacer si falla el sync, el webhook o el cron de notificaciones.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=07, nombre=backend]
Específico del área: audita supabase/functions (validación, errores, idempotencia, secretos usados) y
añade tests Deno donde falten. Escribe la migración de rendimiento (HALLAZGOS #21) como fichero aparte.
Lo que requiera prod (comparar migraciones, versiones desplegadas, cron.job_run_details, parche de
Postgres) déjalo como tareas 💻 en Hallazgos con la consulta SQL exacta.
```
