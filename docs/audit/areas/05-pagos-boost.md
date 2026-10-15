# 05 · Pagos Boost (RevenueCat)

**Prioridad:** 🔴 · **Ejecución:** 💻 local (RevenueCat MCP, logs de Supabase) + 👤 compras en dispositivo · **Rama:** `audit/05-pagos-boost` (solo si hay cambios de código)

## Objetivo
Que comprar un Boost en iOS y Android active el boost del bar correcto, una sola vez, y que los fallos se gestionen sin cobrar sin entregar.

## Estado de partida
Arreglo end-to-end mergeado (`3fbc904`): webhook con `NON_RENEWING_PURCHASE` y upsert idempotente, atributo `boost_bar_id`, sincronización del usuario en RevenueCat, polling «Activando tu boost…», paywall con el DS. Webhook v10 desplegado (`verify_jwt=false`, sin secreto → 401). Offering `default` con `boost_7d`, `boost_1m`, `boost_1y` (9 consumibles).

## Checklist
- [ ] **Productos en las tiendas:** los consumibles existen y están «Listos para enviar» en App Store Connect y activos en Play Console; precios y textos en español.
- [ ] **Android:** app de Play conectada en RevenueCat (credenciales de servicio de Google), productos importados y en la offering.
- [ ] **Compra sandbox iOS** (TestFlight o StoreKit sandbox) → el webhook responde 200, se crea el boost con `end_at` correcto, el bar aparece destacado.
- [ ] **Compra de prueba Android** (licencia de tester en Play) → mismo resultado.
- [ ] **Secreto del webhook:** el `Authorization` de RevenueCat coincide con `REVENUECAT_WEBHOOK_SECRET` (en los logs: 200, no 401).
- [ ] **Casos de error:** cancelar la compra, sin red durante el polling, compra pendiente (Android), reembolso/cancelación (`CANCELLATION`), compra repetida del mismo bar (se extiende o se rechaza, definido y probado).
- [ ] **Restaurar compras:** no aplica a consumibles, pero el botón no debe confundir; si existe, que haga algo coherente.
- [ ] **Paywall:** revisión visual en iPhone pequeño y Android; textos de precio desde la tienda (no fijos); enlaces a Términos y Privacidad (recomendable aunque no sean suscripciones).
- [ ] **Opcional:** desasociar los 9 consumibles del entitlement `boost_active` (no lo usa la app).

## Criterios de aceptación
- Una compra real de prueba por plataforma activa el boost en menos de 30 s y queda en `REGISTRO.md` con el ID de transacción (sin datos personales).

## Hallazgos
| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| | | | |
