# Registro de cambios de la auditoría

Una entrada por cada cambio: PR mergeada, migración aplicada en prod, ajuste en un panel (Supabase, App Store Connect, Play Console, RevenueCat, Firebase, EAS) o decisión tomada. Lo más reciente arriba.

**Plantilla**

```markdown
### AAAA-MM-DD · Área NN · Título corto
- **Tipo:** código | migración prod | panel | decisión | build
- **Qué:** qué se cambió.
- **Por qué:** hallazgo que resuelve (p. ej. HALLAZGOS #2 o 01-H3).
- **Dónde:** PR #, commit, migración, panel.
- **Verificación:** cómo se comprobó (tests, consulta SQL, prueba en dispositivo).
- **Rollback:** cómo deshacerlo si algo falla.
- **Quién:** ☁️ nube / 💻 local / 👤 usuario.
```

---

### 2026-11-05 · Áreas 01 y 04 · Fuga de `public.users`, escalado a super admin y guardia de admin
- **Tipo:** código
- **Qué:** migración `20261105212402_audit01b_users_privacy.sql` (cada usuario lee solo su fila, sin INSERT/DELETE desde cliente, vista `public_profiles` para el autor de las reseñas). Se recupera `AdminOnly` (04-H1), que estaba en `release/qa-final` pero no llegó a `main` con la PR #38.
- **Por qué:** 01-H1, 01-H2, 01-H3, 04-H1.
- **Dónde:** rama `audit/04-admin-guard`. Migración aplicada en prod el 2026-11-05 con aprobación de Roger, antes de publicar la rama porque el repo es público.
- **Verificación:** `tsc` ✅, jest 63 suites / 700 tests ✅, `test:functions` 72 tests ✅ (5 nuevos en `rls_01b_usuarios.test.ts`, que reproducen el escalado en PGlite). En prod: invitado ve 0 filas de `users`, `rls_01b_usuarios.sql` con ROLLBACK OK y sin restos. **Sin verificar:** el embed `user:public_profiles` y la API externa, porque prod responde 402 (01-H7).
- **Rollback:** recrear las 3 políticas y los grants retirados. Reabre los agujeros.
- **Quién:** 💻 local.

### 2026-11-04 · Áreas 06 y 12 · Revisión de código de push y flujos de usuario
- **Tipo:** código
- **Qué:** el push token se desregistra antes de cerrar sesión (06-H2); errores de push a `reportError`; canal Android «Avisos de partidos»; errores de red con reintento en el filtro por partido y en el selector de partidos; corazón de Buscar con aviso a invitado y toast de error; errores de login en español (`formatAuthErrorAlert`).
- **Por qué:** 06-H2, 06-H3, 06-H7, 12-H2…12-H5. Causa probable de 0 tokens en prod: build en tienda anterior al código de push (06-H1).
- **Dónde:** rama `audit/06-12-flujos` (desde `release/qa-final`).
- **Ampliación:** 06-H6 (interruptor de avisos pide permiso / abre Ajustes) y 12-H6 (`utils/userFacingError.ts`, también en `toast.supabaseError`).
- **Verificación:** `npm run typecheck` ✅, `npx jest` 62 suites / 697 tests ✅, eslint de los ficheros tocados 0 errores.
- **Rollback:** revertir los commits de la rama.
- **Quién:** ☁️ nube.

### 2026-10-10 · General · Plan de auditoría creado
- **Tipo:** decisión
- **Qué:** plan maestro en `docs/audit/` con 13 áreas, criterios Go/No-Go y calendario de 2 semanas. Se copia la auditoría del 2026-10-10 como `HALLAZGOS_2026-10-10.md`.
- **Por qué:** salida a mercado en iOS y Android en 1–2 semanas, con modalidad «auditar y arreglar».
- **Dónde:** rama `docs/audit-plan`.
- **Verificación:** estado inicial comprobado en prod con `pg_policies`: los bloqueantes 1–4 siguen abiertos.
- **Rollback:** n/a.
- **Quién:** 💻 local.

### 2026-10-15 · Área 10 · Reparto con la sesión local de release
- **Tipo:** decisión
- **Qué:** la sesión local se queda variables de EAS, credenciales, builds, submit y el runbook; los cambios en `eas.json`/`app.json` se encolan en `areas/10-builds-config.md` (R1–R9).
- **Por qué:** evitar conflictos con la rama `audit/10-builds-config`.
- **Dónde:** rama `docs/audit-plan`, rama `docs/release-runbook`.
- **Verificación:** n/a.
- **Rollback:** n/a.
- **Quién:** 💻 local.
