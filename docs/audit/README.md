# Auditoría de salida a mercado — MatchMap

Plan maestro para verificar que la app está lista para publicarse en **App Store y Google Play**, arreglar lo que falte y dejar constancia de cada cambio.

| | |
|---|---|
| Inicio | 2026-10-15 |
| Objetivo de lanzamiento | 2026-10-28 (2 semanas) |
| Plataformas | iOS y Android |
| Base de código | `origin/main` (`14d0003`) · versión `1.0.16` (iOS build 12, Android versionCode 17) |
| Supabase prod | `hmtfxpihkoisncglllmq` |
| Punto de partida | [`HALLAZGOS_2026-10-10.md`](HALLAZGOS_2026-10-10.md) (23 hallazgos ya identificados) |
| Registro de cambios | [`REGISTRO.md`](REGISTRO.md) |

---

## 1. Criterios de salida (Go / No-Go)

La app sale a mercado cuando **todos** estos puntos están en ✅. Cualquier ❌ es un No-Go.

| # | Criterio | Cómo se comprueba | Estado |
|---|---|---|---|
| G1 | Ningún hallazgo 🔴 abierto | Tablero de la sección 4 | ❌ (06-H1 build nuevo con push, 11-H4 publicar la política con los datos del responsable). 10-H1 resuelto el 2026-11-15 |
| G2 | RLS y Storage: un invitado o un usuario normal no puede leer/escribir datos ajenos | Script de pruebas de RLS del área 01 contra prod | ⏳ Repaso completo de las 47 tablas, funciones y Storage hecho en prod el 2026-11-15: 01-H8 (`bar_boosts`) arreglado y aplicado. Quedan menores: 01-H9 (depende de D3) y 01-H10 |
| G3 | `npm run typecheck`, `npm run lint` (0 errores) y `npm run test:all` en verde sobre `main` | CI local / sesión en la nube | ⏳ (verde con la PR #42 de Prettier; falta fusionarla) |
| G4 | Smoke test manual completo en iPhone y Android físicos con el build de producción | Matriz del área 12 | ⏳ |
| G5 | Compra de Boost real (sandbox) activa el boost en iOS y Android | Área 05 | ❌ |
| G6 | Push de partidos recibidas en iOS y Android | Área 06 | ❌ (falta FCM; 0 tokens en prod) |
| G7 | Borrado de cuenta funciona desde la app (Apple 5.1.1(v), Google Play) | Área 02 | ⏳ (falta probarlo en dispositivo; página web de borrado en la PR #8 de `matchmap-landing`) |
| G8 | Política de privacidad, etiqueta de App Store y *Data safety* de Play coinciden con lo que hace la app | Área 11 | ⏳ (política nueva en `matchmap-landing` PR #8; faltan datos del responsable y rellenar los cuestionarios de las tiendas) |
| G9 | Hay monitorización de crashes en producción | Área 08 | 🛠 EAS Observe integrado (D4). Falta una build con el SDK y ver datos en el panel de Observe |
| G10 | Contenido mínimo: bares aprobados suficientes en las zonas de lanzamiento | Área 13 | ❌ (47 aprobados, de ellos 31 de test: 16 reales; 135 pendientes) |

**Estado verificado el 2026-11-15 contra prod:** Supabase en plan Pro (01-H7 resuelto, la API responde). Aplicadas `20261015130000_review_reports_and_user_blocks` y `20261020000000_perf_rls_initplan_and_fk_indexes`; redesplegadas las 5 edge functions. `main` en Expo SDK 58 (PR #41) y con la PR #39 fusionada. 0 push tokens, 16 bares reales aprobados y 135 pendientes. API-Football en plan Free (sync 502, se paga antes de publicar).

**Estado verificado el 2026-11-05 contra prod:** aplicada `audit01_security_rls_storage` (ya no quedan las políticas antiguas). Aplicada `20261105212402_audit01b_users_privacy`. Sin aplicar: `20261015130000_review_reports_and_user_blocks` y `20261020000000_perf_rls_initplan_and_fk_indexes`. **Toda la API responde 402 por cuota de almacenamiento (01-H7).** Los crons figuran en verde, pero sus llamadas HTTP devuelven 402.

Estado inicial verificado el 2026-10-10 contra prod: los bloqueantes 1–4 de `HALLAZGOS` **siguen abiertos** (políticas `Allow read`, `Allow upload`, `Bar owner: update own bar`, `Reviews: Insert by authenticated users`, `Favorites: Self insert`… presentes en `pg_policies`).

---

## 2. Cómo se trabaja

### Quién hace qué
- ☁️ **Sesión en la nube** (claude.ai/code, consume los créditos de nube): auditar código, escribir arreglos, migraciones como ficheros y tests. Abre una PR por área. **No tiene acceso a prod ni a secretos.**
- 💻 **Sesión local** (Claude Code en el Mac): todo lo que necesita Supabase prod (MCP), simulador, builds EAS o el panel de RevenueCat. Los cambios en prod se aplican **solo con tu aprobación explícita**.
- 👤 **Tú**: decisiones, paneles con login (App Store Connect, Play Console, Firebase, Sentry), pruebas en dispositivo físico, revisar y mergear PRs.

### Flujo de cada área
1. Rama `audit/NN-nombre` desde `origin/main` actualizado.
2. **Auditar**: recorrer la checklist del fichero del área y anotar cada hallazgo nuevo en ese fichero (sección *Hallazgos*), con severidad 🔴/🟠/🟡.
3. **Arreglar** los 🔴 y 🟠 dentro del alcance del área. Los 🟡 se anotan y se dejan para después del lanzamiento salvo que sean triviales.
4. **Verificar**: `npm run typecheck && npm run lint && npm run test:all`. Añadir tests para cada arreglo de lógica (regla del proyecto).
5. **Documentar en la misma PR**: marcar las casillas del área, añadir una entrada a `REGISTRO.md` y actualizar el tablero de la sección 4.
6. PR contra `main` con título `audit(NN): …`. Si hay migración, la PR lo dice en grande: **requiere aplicar en prod**.
7. Tú revisas y mergeas. Las migraciones se aplican después en prod desde una sesión local, se prueban en la app y se anota en `REGISTRO.md`.

### Reglas
- Nunca aplicar migraciones, tocar datos de prod ni cambiar paneles desde la nube.
- No ejecutar `supabase db push` en bloque: la migración `20260518000000_drop_scarves_collectibles` es destructiva y está pendiente de decisión (D3).
- **Recursos del Mac (16 GB)** — el 2026-10-15 se agotó la RAM con 7 agentes locales en paralelo:
  - Máximo **2 sesiones locales** trabajando a la vez y solo **una** ejecutando jest/tsc en cada momento. El resto de áreas, en la nube.
  - jest va limitado a 3 workers (`maxWorkers`) y recicla los que pasan de 512 MB.
  - El hook de pre-commit ejecuta `typecheck` + **toda** la suite: para commits WIP usar `--no-verify` y verificar una sola vez al final.
  - Commit WIP (y push) frecuente: si el Mac se cuelga, no se pierde nada.
  - Antes de lanzar trabajo, comprobar con `ListAgents` qué hacen las otras sesiones (Claude Desktop, Cursor, CLI).
- Una PR por área, pequeña y revisable. Si un área crece, partirla (`01a`, `01b`).
- Las áreas que tocan los mismos ficheros no se lanzan a la vez (ver dependencias del calendario).
- Nada de datos personales (emails, tokens) en logs, PRs ni en estos documentos.

---

## 3. Decisiones que necesito de ti

Bloquean partes del plan. Anota la respuesta aquí y en `REGISTRO.md`.

| # | Decisión | Opciones | Bloquea | Respuesta |
|---|---|---|---|---|
| D1 | Package de Android `com.tuorg.matchmap` es un placeholder. Si la app **no** está publicada aún en Play, es el último momento para cambiarlo (luego es imposible). En iOS ya existe en App Store Connect con ese ID. | Mantener / cambiar Android (p. ej. `com.matchmap.app`) | Área 10, 06 (FCM se registra con el package) | **Mantener** (2026-11-15): la app ya está publicada en App Store y Google Play con ese package. |
| D2 | ¿La cuenta de Google Play Console es **personal y creada después de nov-2023**? Si es así, Google exige una prueba cerrada con **12 testers durante 14 días** antes de poder publicar en producción. | Personal nueva / personal antigua / organización | Fecha de Android | **Resuelta** (2026-11-15): la app ya está publicada en Google Play. |
| D3 | Bufandas coleccionables: ¿se abandona la función? | Aplicar `drop_scarves_collectibles` + borrar `fn_claim_scarf`, `ticket_claims`, bucket `ticket-claims` / borrar la migración y mantenerla | Área 01, 07 | |
| D4 | Monitorización de crashes | Sentry (cuenta gratuita) / EAS Observe / Crashlytics | Área 08 | **EAS Observe** (2026-11-15). Integrado en `utils/observe.ts` (rama `audit/08-observe-rls`). |
| D5 | Zonas/ciudades de lanzamiento y nº mínimo de bares aprobados | — | Área 13 | |
| D6 | Cuenta demo para los revisores de Apple y Google (con bar de propietario para enseñar Boost) | Crear `review@…` / otra | Área 11 | |

---

## 4. Tablero de áreas

Leyenda de ejecución: ☁️ nube · 💻 local · 👤 tú. Estado: ⬜ pendiente · 🔄 en curso · 👀 PR abierta · ✅ hecho (mergeado y, si aplica, aplicado en prod).

| Área | Prioridad | Ejecución | Estado | PR | Notas |
|---|---|---|---|---|---|
| [01 Seguridad Supabase (RLS, Storage, anónimos)](areas/01-seguridad-supabase.md) | 🔴 | ☁️ migración → 💻 aplicar | 🔄 | #39 | Migraciones 01 y 01b aplicadas y PR #39 fusionada. 01-H7 resuelto (Pro). Repaso de RLS hecho y 01-H8 aplicado (2026-11-15); quedan 01-H4/H5 (paneles) |
| [02 Autenticación y cuenta](areas/02-auth-cuenta.md) | 🔴 | ☁️ + 💻 + 👤 | 🔄 | | WIP sin verificar (auth, reset, perfil). Hallazgos 8, 9 |
| [03 Flujos de usuario](areas/03-flujos-usuario.md) | 🟠 | ☁️ | ✅ | | Migración de reportes y bloqueos aplicada en prod el 2026-11-15 |
| [04 Flujos de propietario y admin](areas/04-flujos-propietario-admin.md) | 🟠 | ☁️ | ✅ | #39 | 04-H1 (`AdminOnly`) fusionado con la PR #39 |
| [05 Pagos Boost](areas/05-pagos-boost.md) | 🔴 | 💻 + 👤 | ⬜ | | Hallazgo 7 |
| [06 Notificaciones push](areas/06-push.md) | 🔴 | 👤 + 💻 | 🔄 | | Código revisado (PR #38) y 06-H5 arreglado. Abiertos 06-H1 y 06-H4: build nuevo y FCM (depende de D1) |
| [07 Backend: edge functions, crons y migraciones](areas/07-backend.md) | 🟠 | ☁️ + 💻 | ✅ | | Migración de rendimiento aplicada y funciones redesplegadas el 2026-11-15. Solo quedan 🟡 |
| [08 Estabilidad, calidad y monitorización](areas/08-estabilidad-calidad.md) | 🟠 | ☁️ | 🔄 | | 2 commits + límites de jest. Hallazgos 15, 17, 18. EAS Observe integrado (08-H1) |
| [09 Rendimiento](areas/09-rendimiento.md) | 🟡 | ☁️ + 💻 | ⬜ | | Solo regresiones graves antes del lanzamiento |
| [10 Builds y configuración de tiendas](areas/10-builds-config.md) | 🔴 | ☁️ + 💻 + 👤 | 🔄 | | 2 commits. Hallazgos 5, 19, 20 |
| [11 Cumplimiento de tiendas y legal](areas/11-cumplimiento-legal.md) | 🔴 | ☁️ + 👤 | 🔄 | landing #8 | 11-H5/H7/H9/H11 resueltos. Política y página de borrado en `matchmap-landing` (falta el responsable). Quedan 11-H8 y los cuestionarios de las tiendas |
| [12 QA manual en dispositivos](areas/12-qa-manual.md) | 🔴 | 👤 + 💻 | ⬜ | | Última puerta antes de enviar |
| [13 Contenido y datos](areas/13-contenido-datos.md) | 🟠 | 👤 + 💻 | ⬜ | | Hallazgo 14 |

Fuera de alcance hasta después del lanzamiento: accesibilidad completa, limpieza de `docs/` (hallazgo 23), refactors de deuda técnica sin impacto en usuario.

---

## 5. Calendario (2 semanas)

| Días | Trabajo | Paralelo en la nube |
|---|---|---|
| 1 (15-oct) | Decisiones D1–D6. Arrancar áreas 01, 08 y 11 en la nube. 👤 crear proyecto Firebase (06) y revisar tipo de cuenta de Play (D2). | 01 · 08 · 11 |
| 2–3 | Revisar PR de 01 → aplicar migración en prod (💻) y probar subidas, reseñas, favoritos. Arrancar 02, 03, 07. | 02 · 03 · 07 |
| 3–4 | 06 (FCM + APNs), 10 (eas.json, package, versiones). Arrancar 04 (ya con las políticas nuevas de Storage). | 04 · 10 |
| 5 | Build de producción interna (EAS) iOS + Android → TestFlight y prueba interna/cerrada de Play. | 09 |
| 6–7 | 05 compra sandbox en ambos stores. 12 QA ronda 1. 13 aprobar bares. | — |
| 8–9 | Arreglos de la ronda 1 de QA. 11 fichas de tienda, capturas, privacidad. | arreglos |
| 10 | Build release candidate. QA ronda 2 (regresión completa). Go/No-Go. | — |
| 11–12 | Envío a revisión de Apple y Google. Margen para rechazos. | — |
| 13–14 | Publicación (fase escalonada en Play 20 % → 100 %). Vigilar crashes y logs del webhook. | — |

⚠️ Si D2 = cuenta personal nueva, Android no puede salir a producción antes de **14 días** de prueba cerrada con 12 testers: hay que empezarla el día 5 como muy tarde y lanzar iOS primero.

---

## 6. Cómo lanzar un área en la nube

1. Asegúrate de que esta carpeta está mergeada en `main` en GitHub.
2. Abre **claude.ai/code** → repo `u1967582/MatchMap` → rama `main`.
3. Pega el prompt de la sección *Prompt para la sesión en la nube* del fichero del área.
4. Cuando abra la PR, revísala aquí o en GitHub. Si incluye migración, pídeme en local que la aplique en prod.

Prompt base (cada área añade su parte específica):

```text
Eres responsable del área NN de la auditoría de salida a mercado de MatchMap.
Lee docs/audit/README.md (proceso y reglas), docs/audit/HALLAZGOS_2026-10-10.md
y docs/audit/areas/NN-*.md. Trabaja en la rama audit/NN-<nombre>.
1) Audita siguiendo la checklist y anota cada hallazgo nuevo en el fichero del área.
2) Arregla los 🔴 y 🟠 de tu alcance; los 🟡 solo anótalos.
3) Añade tests para cada arreglo y ejecuta npm run typecheck, npm run lint y npm run test:all.
4) Marca las casillas, añade una entrada en docs/audit/REGISTRO.md y actualiza el tablero del README.
5) Abre una PR "audit(NN): …". No tienes acceso a producción: las migraciones van como ficheros
   en supabase/migrations y la PR debe indicar "REQUIERE APLICAR EN PROD".
Responde y documenta en español.
```
