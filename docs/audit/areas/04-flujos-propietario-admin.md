# 04 · Flujos de propietario y admin

**Prioridad:** 🟠 · **Ejecución:** ☁️ (después de mergear 01) · **Rama:** `audit/04-propietario-admin`

## Objetivo
Que un dueño pueda registrar o reclamar su bar, gestionarlo y que el equipo de MatchMap pueda verificar y moderar, sin agujeros de permisos en la UI.

## Alcance
Registro de bar (`app/register-bar`, `screens/registerBar/*`, `stores/barRegisterStore.ts`, `app/(protected)/add-bar.tsx`), reclamar bar (`app/claim-bar/[barId].tsx`), edición (`app/edit-bar-info`, `app/bar-menu`), posts (`app/create-post`, `app/edit-post`), estadísticas (`app/bar-stats`, `services/barAnalytics.ts`), emisiones automáticas (`app/auto-broadcasts`, `app/manual-match-selection`, `hooks/useAutoBroadcastPreferences.ts`), admin (`bar-verification-admin`, `bar-claims-admin`, `bar-reports-admin`, `support-admin`, `admin-gift-boost`, `admin-select-bar-auto-broadcasts`, `hooks/useIsAdmin.ts`), edge function `promote_pre_registered_bar_with_images`.

## Checklist
- [ ] **Registro de bar:** los 4 pasos validan, se puede volver atrás sin perder datos, las fotos se redimensionan y suben con las políticas nuevas de Storage, el bar queda `pending`.
- [ ] **Reclamar bar:** el documento sube al bucket privado y solo lo ven el autor y los admins; estados de la reclamación visibles para el usuario.
- [ ] **Edición:** el dueño solo ve «editar» en sus bares; no puede cambiar campos protegidos (la UI no los envía, y el trigger de 01 lo impide).
- [ ] **Posts:** crear, editar, borrar con imagen; posts de otros bares no editables.
- [ ] **Emisiones automáticas y selección manual de partidos:** guardar preferencias, que se reflejen en la ficha y el mapa.
- [ ] **Estadísticas:** cifras coherentes; sin datos → estado vacío.
- [ ] **Pantallas de admin:** accesibles solo con `is_super_admin()` también en el servidor (no solo ocultando el botón). Probar navegando por URL/deep link como usuario normal.
- [ ] **Cola de verificación:** aprobar/rechazar uno y por lotes (pestaña «Sin dueño»), notifica al dueño si aplica.
- [ ] **Moderación:** atender reportes de bar (y de reseña si se añade en 03) y tickets de soporte.

## Criterios de aceptación
- Un usuario normal no puede abrir ni ejecutar ninguna acción de admin, aunque conozca la ruta.
- Flujo completo registrar → aprobar → aparece en el mapa probado en simulador.

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |

## Prompt para la sesión en la nube
```text
[Prompt base del README con NN=04, nombre=propietario-admin]
Específico del área: empieza solo cuando la PR del área 01 esté mergeada (compruébalo en el tablero).
Verifica que cada pantalla de admin tiene guardia en cliente Y que la operación que ejecuta está
protegida en el servidor (RLS o is_super_admin() en la RPC). Revisa que las rutas de subida coinciden
con las políticas de Storage del área 01.
```
