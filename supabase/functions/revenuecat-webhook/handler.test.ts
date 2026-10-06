// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertExists } from 'jsr:@std/assert@1';
import { createFakeSupabase, op, quiet, type Responder } from '../_shared/fakeSupabase.ts';
import { createHandler } from './handler.ts';

const SECRET = 'Bearer rc-secret';

function setup(respond?: Responder, env: Record<string, string> = { REVENUECAT_WEBHOOK_SECRET: SECRET }) {
  const fake = createFakeSupabase({ respond });
  const handler = createHandler({ env: (k) => env[k], getClient: () => fake.client });
  return { ...fake, handler };
}

const req = (event: any, auth: string | null = SECRET) =>
  new Request('http://localhost/revenuecat-webhook', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify({ event }),
  });

const purchase = (overrides: any = {}) => ({
  type: 'INITIAL_PURCHASE',
  original_transaction_id: 'tx-1',
  app_user_id: 'user-1',
  product_id: 'boost_1m_v2',
  price: 9.99,
  currency: 'EUR',
  expiration_at_ms: Date.UTC(2026, 10, 6),
  ...overrides,
});

Deno.test('401 sin cabecera Authorization', async () => {
  const { handler, calls } = setup();
  const res = await handler(req(purchase(), null));
  assertEquals(res.status, 401);
  assertEquals(calls.length, 0);
});

Deno.test('401 con secreto incorrecto', async () => {
  const { handler } = setup();
  assertEquals((await handler(req(purchase(), 'Bearer otro'))).status, 401);
});

Deno.test('401 si el secreto no está configurado en el entorno (no acepta cualquier cosa)', async () => {
  const { handler } = setup(undefined, {});
  assertEquals((await handler(req(purchase(), 'undefined'))).status, 401);
});

Deno.test('INITIAL_PURCHASE activa el boost pendiente por transaction id', async () => {
  const { handler, calls } = setup(() => ({ data: [{ id: 'boost-1' }] }));
  const res = await quiet(() => handler(req(purchase())));
  assertEquals(res.status, 200);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, 'bar_boosts');
  assertEquals(op(calls[0], 'update')?.args[0], { status: 'active' });
  assertEquals(op(calls[0], 'eq')?.args, ['revenuecat_transaction_id', 'tx-1']);
});

Deno.test('RENEWAL activa el boost existente', async () => {
  const { handler, calls } = setup(() => ({ data: [{ id: 'boost-1' }] }));
  await quiet(() => handler(req(purchase({ type: 'RENEWAL' }))));
  assertEquals(op(calls[0], 'update')?.args[0], { status: 'active' });
});

Deno.test('INITIAL_PURCHASE sin fila previa: INSERT de rescate con los datos del evento', async () => {
  const { handler, calls } = setup((c) => {
    if (c.table === 'bar_boosts' && op(c, 'update')) return { data: [] };
    if (c.table === 'bars') return { data: { id: 'bar-9' } };
    return { data: null };
  });
  const res = await quiet(() => handler(req(purchase())));
  assertEquals(res.status, 200);

  const barsQuery = calls.find((c) => c.table === 'bars')!;
  assertEquals(op(barsQuery, 'eq')?.args, ['owner_id', 'user-1']);

  const insert = calls.find((c) => op(c, 'insert'));
  assertExists(insert);
  const row = op(insert!, 'insert')!.args[0];
  assertEquals(row.bar_id, 'bar-9');
  assertEquals(row.user_id, 'user-1');
  assertEquals(row.plan, '1m');
  assertEquals(row.status, 'active');
  assertEquals(row.amount_cents, 999);
  assertEquals(row.currency, 'eur');
  assertEquals(row.revenuecat_transaction_id, 'tx-1');
  assertEquals(row.end_at, new Date(Date.UTC(2026, 10, 6)).toISOString());
});

for (const [productId, plan] of [
  ['boost_7d_v2', '7d'],
  ['boost_1m_v2', '1m'],
  ['boost_1y_v2', '1y'],
  ['rc_promo_boost_1y_v2_yearly', '1y'],
]) {
  Deno.test(`producto ${productId} → plan ${plan}`, async () => {
    const { handler, calls } = setup((c) =>
      c.table === 'bars' ? { data: { id: 'bar-9' } } : { data: [] }
    );
    await quiet(() => handler(req(purchase({ product_id: productId }))));
    const insert = calls.find((c) => op(c, 'insert'))!;
    assertEquals(op(insert, 'insert')!.args[0].plan, plan);
  });
}

Deno.test('producto desconocido: no inserta nada', async () => {
  const { handler, calls } = setup((c) =>
    c.table === 'bars' ? { data: { id: 'bar-9' } } : { data: [] }
  );
  const res = await quiet(() => handler(req(purchase({ product_id: 'otra_cosa' }))));
  assertEquals(res.status, 200);
  assertEquals(calls.some((c) => op(c, 'insert')), false);
});

Deno.test('usuario sin bar: no inserta nada', async () => {
  const { handler, calls } = setup((c) => (c.table === 'bars' ? { data: null } : { data: [] }));
  await quiet(() => handler(req(purchase())));
  assertEquals(calls.some((c) => op(c, 'insert')), false);
});

Deno.test('RENEWAL sin fila previa: no hace INSERT de rescate', async () => {
  const { handler, calls } = setup(() => ({ data: [] }));
  await quiet(() => handler(req(purchase({ type: 'RENEWAL' }))));
  assertEquals(calls.length, 1);
});

for (const type of ['CANCELLATION', 'EXPIRATION']) {
  Deno.test(`${type} marca el boost como expired`, async () => {
    const { handler, calls } = setup(() => ({ data: [{ id: 'b' }] }));
    const res = await quiet(() => handler(req(purchase({ type }))));
    assertEquals(res.status, 200);
    assertEquals(op(calls[0], 'update')?.args[0], { status: 'expired' });
    assertEquals(op(calls[0], 'eq')?.args, ['revenuecat_transaction_id', 'tx-1']);
  });
}

Deno.test('error en el UPDATE no provoca INSERT', async () => {
  const { handler, calls } = setup(() => ({ data: null, error: { message: 'db' } }));
  const res = await quiet(() => handler(req(purchase())));
  assertEquals(res.status, 200);
  assertEquals(calls.length, 1);
});

Deno.test('eventos no gestionados (TEST, etc.) responden 200 sin tocar la BD', async () => {
  const { handler, calls } = setup();
  const res = await handler(req(purchase({ type: 'TEST' })));
  assertEquals(res.status, 200);
  assertEquals(calls.length, 0);
});

Deno.test('JSON inválido → 400', async () => {
  const { handler } = setup();
  const bad = new Request('http://localhost', {
    method: 'POST',
    headers: { Authorization: SECRET },
    body: '{no json',
  });
  assertEquals((await quiet(() => handler(bad))).status, 400);
});
