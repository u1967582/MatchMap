// deno-lint-ignore-file no-explicit-any
import { assertEquals } from 'jsr:@std/assert@1';
import { createFakeSupabase, op, quiet } from '../_shared/fakeSupabase.ts';
import { chunk, createHandler, EXPO_PUSH_API_URL, pickCopy, type PendingRow } from './handler.ts';

const row = (o: Partial<PendingRow> = {}): PendingRow => ({
  user_id: 'u1',
  match_id: 'm1',
  push_token_id: 't1',
  expo_push_token: 'ExponentPushToken[1]',
  favorite_team_id: 'team',
  favorite_team_name: 'Betis',
  opponent_name: 'Sevilla',
  is_home: true,
  datetime_utc: '2026-10-10T19:00:00Z',
  competition_name: 'LaLiga',
  ...o,
});

function setup({
  pending = [] as PendingRow[],
  tickets = (msgs: any[]) => msgs.map(() => ({ status: 'ok' })) as any[],
  httpStatus = 200,
  secret = 'cron-secret',
} = {}) {
  const fake = createFakeSupabase({
    rpc: (fn) => {
      if (fn === 'get_cron_secret') return { data: secret };
      if (fn === 'fn_get_pending_match_notifications') return { data: pending };
      return {};
    },
  });
  const sent: any[][] = [];
  const fetchMock = (async (url: string, init: any) => {
    assertEquals(url, EXPO_PUSH_API_URL);
    const msgs = JSON.parse(init.body);
    sent.push(msgs);
    return new Response(JSON.stringify({ data: tickets(msgs) }), { status: httpStatus });
  }) as any;
  const handler = createHandler({ supabase: fake.client, fetch: fetchMock });
  return { ...fake, handler, sent };
}

const req = (secret: string | null = 'cron-secret') =>
  new Request('http://localhost', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} });

Deno.test('chunk parte arrays en trozos', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assertEquals(chunk([], 3), []);
});

Deno.test('pickCopy menciona al equipo y usa la hora de Madrid', () => {
  for (let i = 0; i < 30; i++) {
    const { title, body } = pickCopy(row());
    assertEquals(`${title} ${body}`.includes('Betis'), true);
    if (body.includes('sale a las')) assertEquals(body.includes('21:00'), true); // 19:00Z = 21:00 Madrid (CEST)
  }
});

Deno.test('401 sin secreto o con secreto incorrecto', async () => {
  const { handler, rpcCalls } = setup();
  assertEquals((await quiet(() => handler(req(null)))).status, 401);
  assertEquals((await quiet(() => handler(req('mal')))).status, 401);
  assertEquals(rpcCalls.some((c) => c.fn === 'fn_get_pending_match_notifications'), false);
});

Deno.test('401 si no se puede leer el secreto del Vault', async () => {
  const { handler } = setup({ secret: '' });
  assertEquals((await quiet(() => handler(req()))).status, 401);
});

Deno.test('sin pendientes no envía nada', async () => {
  const { handler, sent } = setup();
  const res = await quiet(() => handler(req()));
  assertEquals(res.status, 200);
  assertEquals((await res.json()).results.push_messages_sent, 0);
  assertEquals(sent.length, 0);
});

Deno.test('envía a todos los dispositivos y marca cada usuario+partido una sola vez', async () => {
  const { handler, sent, calls } = setup({
    pending: [
      row({ push_token_id: 't1', expo_push_token: 'A' }),
      row({ push_token_id: 't2', expo_push_token: 'B' }),
      row({ user_id: 'u2', push_token_id: 't3', expo_push_token: 'C' }),
    ],
  });
  const res = await quiet(() => handler(req()));
  const { results } = await res.json();
  assertEquals(results, { matches: 1, users_notified: 2, push_messages_sent: 3, tokens_removed: 0 });
  assertEquals(sent[0].map((m: any) => m.to), ['A', 'B', 'C']);
  // mismo copy para los dispositivos del mismo usuario
  assertEquals(sent[0][0].title, sent[0][1].title);
  assertEquals(sent[0][0].data, { matchId: 'm1', type: 'favorite_team_match' });

  const upsert = calls.find((c) => c.table === 'match_notifications_sent')!;
  assertEquals(op(upsert, 'upsert')!.args[0], [
    { user_id: 'u1', match_id: 'm1' },
    { user_id: 'u2', match_id: 'm1' },
  ]);
});

Deno.test('borra tokens DeviceNotRegistered y no marca al usuario si todos sus envíos fallan', async () => {
  const { handler, calls } = setup({
    pending: [row({ push_token_id: 'dead' })],
    tickets: () => [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }],
  });
  const { results } = await (await quiet(() => handler(req()))).json();
  assertEquals(results.tokens_removed, 1);
  assertEquals(results.users_notified, 0);
  const del = calls.find((c) => c.table === 'push_tokens')!;
  assertEquals(op(del, 'eq')!.args, ['id', 'dead']);
  assertEquals(calls.some((c) => c.table === 'match_notifications_sent'), false);
});

Deno.test('envía en lotes de 100 y si Expo falla no marca ese lote (reintento en el siguiente cron)', async () => {
  const pending = Array.from({ length: 150 }, (_, i) =>
    row({ user_id: `u${i}`, push_token_id: `t${i}`, expo_push_token: `T${i}` })
  );
  const { handler, sent } = setup({ pending, httpStatus: 500 });
  const { results } = await (await quiet(() => handler(req()))).json();
  assertEquals(sent.map((s) => s.length), [100, 50]);
  assertEquals(results.users_notified, 0);
});

Deno.test('500 si falla la RPC de pendientes', async () => {
  const fake = createFakeSupabase({
    rpc: (fn) => (fn === 'get_cron_secret' ? { data: 's' } : { error: { message: 'boom' } }),
  });
  const handler = createHandler({ supabase: fake.client, fetch: fetch });
  assertEquals((await quiet(() => handler(req('s')))).status, 500);
});
