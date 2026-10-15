// deno-lint-ignore-file no-explicit-any
import { assertEquals } from 'jsr:@std/assert@1';
import { createFakeSupabase, op, type QueryCall, quiet } from '../_shared/fakeSupabase.ts';
import { createHandler } from './handler.ts';

const SECRET = 'Bearer rc-secret';
const OWNER = '11111111-1111-4111-8111-111111111111';
const BAR = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-15T10:00:00.000Z');

const isTxLookup = (c: QueryCall) =>
  c.table === 'bar_boosts' &&
  op(c, 'select')?.args[0] === 'id, bar_id, status' &&
  op(c, 'eq')?.args[0] === 'revenuecat_transaction_id';
const isCurrentLookup = (c: QueryCall) =>
  c.table === 'bar_boosts' && op(c, 'select')?.args[0] === 'end_at';

function setup({
  existing = null as any,
  currentEndAt = null as string | null,
  bar = { id: BAR, owner_id: OWNER } as any,
  updated = [{ id: 'b1' }] as any[],
  failOn = null as null | ((c: QueryCall) => boolean),
  secret = SECRET as string | undefined,
} = {}) {
  const fake = createFakeSupabase({
    respond: (c) => {
      if (failOn?.(c)) return { error: { message: 'db caída' } };
      if (isTxLookup(c)) return { data: existing };
      if (isCurrentLookup(c)) return { data: currentEndAt ? { end_at: currentEndAt } : null };
      if (c.table === 'bars') return { data: bar };
      if (c.table === 'bar_boosts' && op(c, 'update')) return { data: updated };
      return { data: null };
    },
  });
  const handler = createHandler({ getClient: () => fake.client, secret, now: () => NOW });
  return { ...fake, handler };
}

const event = (o: Record<string, unknown> = {}) => ({
  type: 'NON_RENEWING_PURCHASE',
  app_user_id: OWNER,
  transaction_id: 'tx-1',
  product_id: 'matchmap_boost_7d',
  price: 5.49,
  price_in_purchased_currency: 4.99,
  currency: 'EUR',
  subscriber_attributes: { boost_bar_id: { value: BAR } },
  ...o,
});

const req = (body: unknown, auth: string | null = SECRET, method = 'POST') =>
  new Request('http://localhost/revenuecat-webhook', {
    method,
    headers: auth ? { Authorization: auth } : {},
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

const upsertRow = (calls: QueryCall[]) => {
  const c = calls.find((x) => x.table === 'bar_boosts' && op(x, 'upsert'));
  return c ? op(c, 'upsert')!.args[0] : undefined;
};

Deno.test('401 sin secreto o con secreto incorrecto', async () => {
  const { handler, calls } = setup();
  assertEquals((await handler(req({ event: event() }, null))).status, 401);
  assertEquals((await handler(req({ event: event() }, 'Bearer otro'))).status, 401);
  assertEquals(calls.length, 0);
});

Deno.test('401 si la función no tiene REVENUECAT_WEBHOOK_SECRET configurado', async () => {
  const { handler } = setup({ secret: undefined });
  assertEquals((await handler(req({ event: event() }, ''))).status, 401);
});

Deno.test('405 con métodos distintos de POST', async () => {
  const { handler } = setup();
  assertEquals((await handler(req(null, SECRET, 'GET'))).status, 405);
});

Deno.test('400 con JSON malformado o sin event.type, sin filtrar el error interno', async () => {
  const { handler } = setup();
  const bad = await handler(req('{no-json'));
  assertEquals(bad.status, 400);
  assertEquals(await bad.json(), { error: 'invalid_payload' });
  assertEquals((await handler(req({ event: {} }))).status, 400);
  assertEquals((await handler(req({}))).status, 400);
});

Deno.test('ignora eventos no relevantes (TEST) con 200', async () => {
  const { handler, calls } = setup();
  const res = await handler(req({ event: { type: 'TEST' } }));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).ignored, 'TEST');
  assertEquals(calls.length, 0);
});

Deno.test('activa el boost con importe en la moneda de compra', async () => {
  const { handler, calls } = setup();
  const res = await quiet(() => handler(req({ event: event() })));
  assertEquals(res.status, 200);
  const row = upsertRow(calls);
  assertEquals(row.bar_id, BAR);
  assertEquals(row.user_id, OWNER);
  assertEquals(row.plan, '7d');
  assertEquals(row.status, 'active');
  assertEquals(row.amount_cents, 499);
  assertEquals(row.currency, 'eur');
  assertEquals(row.start_at, NOW.toISOString());
  assertEquals(row.end_at, '2026-10-22T10:00:00.000Z');
  const upsert = calls.find((x) => x.table === 'bar_boosts' && op(x, 'upsert'))!;
  assertEquals(op(upsert, 'upsert')!.args[1], { onConflict: 'revenuecat_transaction_id' });
});

Deno.test('activa una fila pending creada por el cliente', async () => {
  const { handler, calls } = setup({ existing: { id: 'b1', bar_id: BAR, status: 'pending' } });
  await quiet(() => handler(req({ event: event() })));
  assertEquals(upsertRow(calls)?.status, 'active');
});

Deno.test('idempotente: un reintento de una compra ya activa no extiende el boost', async () => {
  const { handler, calls } = setup({ existing: { id: 'b1', bar_id: BAR, status: 'active' } });
  const res = await quiet(() => handler(req({ event: event() })));
  assertEquals(res.status, 200);
  assertEquals(upsertRow(calls), undefined);
});

Deno.test('un reintento tardío no reactiva un boost reembolsado o caducado', async () => {
  for (const status of ['cancelled', 'expired']) {
    const { handler, calls } = setup({ existing: { id: 'b1', bar_id: BAR, status } });
    const res = await quiet(() => handler(req({ event: event() })));
    assertEquals(res.status, 200);
    assertEquals(upsertRow(calls), undefined, `no debe reactivar ${status}`);
  }
});

Deno.test('encadena tras un boost activo del mismo bar', async () => {
  const { handler, calls } = setup({ currentEndAt: '2026-10-20T00:00:00.000Z' });
  await quiet(() => handler(req({ event: event() })));
  const row = upsertRow(calls);
  assertEquals(row.start_at, '2026-10-20T00:00:00.000Z');
  assertEquals(row.end_at, '2026-10-27T00:00:00.000Z');
});

Deno.test(
  'producto desconocido o bar inexistente: 200 sin activar (reintentar no lo arregla)',
  async () => {
    const a = setup();
    assertEquals(
      (await quiet(() => a.handler(req({ event: event({ product_id: 'otro' }) })))).status,
      200
    );
    assertEquals(upsertRow(a.calls), undefined);

    const b = setup({ bar: null });
    assertEquals((await quiet(() => b.handler(req({ event: event() })))).status, 200);
    assertEquals(upsertRow(b.calls), undefined);
  }
);

Deno.test('sin transaction_id: 200 e ignorado', async () => {
  const { handler, calls } = setup();
  const res = await quiet(() => handler(req({ event: event({ transaction_id: null }) })));
  assertEquals((await res.json()).ignored, 'no_transaction_id');
  assertEquals(calls.length, 0);
});

Deno.test('REFUND cancela y EXPIRATION expira por transaction_id', async () => {
  for (const [type, status] of [
    ['REFUND', 'cancelled'],
    ['CANCELLATION', 'cancelled'],
    ['EXPIRATION', 'expired'],
  ]) {
    const { handler, calls } = setup();
    const res = await quiet(() => handler(req({ event: event({ type }) })));
    assertEquals(res.status, 200);
    const upd = calls.find((c) => c.table === 'bar_boosts' && op(c, 'update'))!;
    assertEquals(op(upd, 'update')!.args[0], { status });
    assertEquals(op(upd, 'eq')!.args, ['revenuecat_transaction_id', 'tx-1']);
  }
});

Deno.test('error de BD: 500 genérico para que RevenueCat reintente', async () => {
  const { handler } = setup({ failOn: isTxLookup });
  const res = await quiet(() => handler(req({ event: event() })));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'internal_error' });
});
