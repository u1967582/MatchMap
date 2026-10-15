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
| G1 | Ningún hallazgo 🔴 abierto | Tablero de la sección 4 | ❌ |
| G2 | RLS y Storage: un invitado o un usuario normal no puede leer/escribir datos ajenos | Script de pruebas de RLS del área 01 contra prod | ❌ |
| G3 | `npm run typecheck`, `npm run lint` (0 errores) y `npm run test:all` en verde sobre `main` | CI local / sesión en la nube | ⏳ |
| G4 | Smoke test manual completo en iPhone y Android físicos con el build de producción | Matriz del área 12 | ⏳ |
| G5 | Compra de Boost real (sandbox) activa el boost en iOS y Android | Área 05 | ❌ |
| G6 | Push de partidos recibidas en iOS y Android | Área 06 | ❌ (falta FCM) |
| G7 | Borrado de cuenta funciona desde la app (Apple 5.1.1(v), Google Play) | Área 02 | ⏳ |
| G8 | Política de privacidad, etiqueta de App Store y *Data safety* de Play coinciden con lo que hace la app | Área 11 | ⏳ |
| G9 | Hay monitorización de crashes en producción | Área 08 | ❌ |
| G10 | Contenido mínimo: bares aprobados suficientes en las zonas de lanzamiento | Área 13 | ❌ (47 aprobados / 135 pendientes) |

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
- Una PR por área, pequeña y revisable. Si un área crece, partirla (`01a`, `01b`).
- Las áreas que tocan los mismos ficheros no se lanzan a la vez (ver dependencias del calendario).
- Nada de datos personales (emails, tokens) en logs, PRs ni en estos documentos.

---

## 3. Decisiones que necesito de ti

Bloquean partes del plan. Anota la respuesta aquí y en `REGISTRO.md`.

| # | Decisión | Opciones | Bloquea | Respuesta |
|---|---|---|---|---|
| D1 | Package de Android `com.tuorg.matchmap` es un placeholder. Si la app **no** está publicada aún en Play, es el último momento para cambiarlo (luego es imposible). En iOS ya existe en App Store Connect con ese ID. | Mantener / cambiar Android (p. ej. `com.matchmap.app`) | Área 10, 06 (FCM se registra con el package) | |
| D2 | ¿La cuenta de Google Play Console es **personal y creada después de nov-2023**? Si es así, Google exige una prueba cerrada con **12 testers durante 14 días** antes de poder publicar en producción. | Personal nueva / personal antigua / organización | Fecha de Android | |
| D3 | Bufandas coleccionables: ¿se abandona la función? | Aplicar `drop_scarves_collectibles` + borrar `fn_claim_scarf`, `ticket_claims`, bucket `ticket-claims` / borrar la migración y mantenerla | Área 01, 07 | |
| D4 | Monitorización de crashes | Sentry (cuenta gratuita) / EAS Observe / Crashlytics | Área 08 | |
| D5 | Zonas/ciudades de lanzamiento y nº mínimo de bares aprobados | — | Área 13 | |
| D6 | Cuenta demo para los revisores de Apple y Google (con bar de propietario para enseñar Boost) | Crear `review@…` / otra | Área 11 | |

---

## 4. Tablero de áreas

Leyenda de ejecución: ☁️ nube · 💻 local · 👤 tú. Estado: ⬜ pendiente · 🔄 en curso · 👀 PR abierta · ✅ hecho (mergeado y, si aplica, aplicado en prod).

| Área | Prioridad | Ejecución | Estado | PR | Notas |
|---|---|---|---|---|---|
| [01 Seguridad Supabase (RLS, Storage, anónimos)](areas/01-seguridad-supabase.md) | 🔴 | ☁️ migración → 💻 aplicar | ⬜ | | Hallazgos 1–4, 11, 13 |
| [02 Autenticación y cuenta](areas/02-auth-cuenta.md) | 🔴 | ☁️ + 💻 + 👤 | ⬜ | | Hallazgos 8, 9 |
| [03 Flujos de usuario](areas/03-flujos-usuario.md) | 🟠 | ☁️ | ⬜ | | Hallazgo 16 |
| [04 Flujos de propietario y admin](areas/04-flujos-propietario-admin.md) | 🟠 | ☁️ | ⬜ | | Depende de 01 (subidas) |
| [05 Pagos Boost](areas/05-pagos-boost.md) | 🔴 | 💻 + 👤 | ⬜ | | Hallazgo 7 |
| [06 Notificaciones push](areas/06-push.md) | 🔴 | 👤 + 💻 | ⬜ | | Hallazgo 6, depende de D1 |
| [07 Backend: edge functions, crons y migraciones](areas/07-backend.md) | 🟠 | ☁️ + 💻 | ⬜ | | Hallazgos 10, 12, 21 |
| [08 Estabilidad, calidad y monitorización](areas/08-estabilidad-calidad.md) | 🟠 | ☁️ | ⬜ | | Hallazgos 15, 17, 18 |
| [09 Rendimiento](areas/09-rendimiento.md) | 🟡 | ☁️ + 💻 | ⬜ | | Solo regresiones graves antes del lanzamiento |
| [10 Builds y configuración de tiendas](areas/10-builds-config.md) | 🔴 | ☁️ + 💻 + 👤 | ⬜ | | Hallazgos 5, 19, 20 |
| [11 Cumplimiento de tiendas y legal](areas/11-cumplimiento-legal.md) | 🔴 | ☁️ + 👤 | ⬜ | | Hallazgo 22 |
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
