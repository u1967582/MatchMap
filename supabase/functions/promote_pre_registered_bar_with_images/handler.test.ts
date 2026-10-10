// deno-lint-ignore-file no-explicit-any
import { assertEquals } from 'jsr:@std/assert@1';
import { createFakeSupabase, op, quiet, type QueryCall } from '../_shared/fakeSupabase.ts';
import { createHandler, extractBarId, toBucketPath } from './handler.ts';

const OWNER = {
  id: 'owner-1',
  email: 'Dueno@Bar.com',
  email_confirmed_at: '2026-01-01',
  is_anonymous: false,
};

const PRE_BAR = { converted_bar_id: null, status: 'pre_registered', name: 'Bar', email: 'dueno@bar.com ' };

function setup({
  user = OWNER as any,
  preBar = PRE_BAR as any,
  tables = {} as Record<string, (c: QueryCall) => any>,
  rpc = (() => ({ data: 'bar-new' })) as any,
  move = (() => ({})) as any,
} = {}) {
  const fake = createFakeSupabase({
    getUser: (token) => ({ data: { user: token === 'tok' ? user : null } }),
    rpc,
    storage: { move: (_b, from, to) => move(from, to) },
    respond: (c) => {
      if (tables[c.table]) return tables[c.table](c);
      if (c.table === 'auto_pre_register_bars') return { data: preBar };
      return { data: [] };
    },
  });
  return { ...fake, handler: createHandler({ getClient: () => fake.client }) };
}

const req = (body: any, token: string | null = 'tok') =>
  new Request('http://localhost', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });

const BODY = { preBarId: 'pre-1', ownerId: 'owner-1' };

Deno.test('extractBarId acepta string, objetos con distintas claves o null', () => {
  assertEquals(extractBarId('uuid-1'), 'uuid-1');
  assertEquals(extractBarId({ bar_id: 'a' }), 'a');
  assertEquals(extractBarId({ id: 'b' }), 'b');
  assertEquals(extractBarId({ barId: 'c' }), 'c');
  assertEquals(extractBarId({ otra: 1 }), null);
  assertEquals(extractBarId(null), null);
});

Deno.test('toBucketPath convierte URLs públicas en paths del bucket', () => {
  assertEquals(
    toBucketPath('https://x.supabase.co/storage/v1/object/public/bar-images/pre/1/a.jpg', 'bar-images'),
    'pre/1/a.jpg',
  );
  assertEquals(toBucketPath('pre/1/a.jpg', 'bar-images'), 'pre/1/a.jpg');
});

Deno.test('400 si faltan parámetros', async () => {
  const { handler } = setup();
  assertEquals((await quiet(() => handler(req({ preBarId: 'x' })))).status, 400);
});

Deno.test('401 sin token, con usuario anónimo o con email sin confirmar', async () => {
  assertEquals((await quiet(() => setup().handler(req(BODY, null)))).status, 401);
  assertEquals((await quiet(() => setup({ user: { ...OWNER, is_anonymous: true } }).handler(req(BODY)))).status, 401);
  assertEquals((await quiet(() => setup({ user: { ...OWNER, email_confirmed_at: null } }).handler(req(BODY)))).status, 401);
});

Deno.test('403 si ownerId no es el usuario autenticado', async () => {
  const { handler, rpcCalls } = setup();
  assertEquals((await quiet(() => handler(req({ ...BODY, ownerId: 'otro' })))).status, 403);
  assertEquals(rpcCalls.length, 0);
});

Deno.test('403 si el email del pre-registro no es el del usuario', async () => {
  const { handler, rpcCalls } = setup({ preBar: { ...PRE_BAR, email: 'otro@bar.com' } });
  assertEquals((await quiet(() => handler(req(BODY)))).status, 403);
  assertEquals(rpcCalls.length, 0);
});

Deno.test('400 si el pre-bar no está en estado pre_registered', async () => {
  const { handler, rpcCalls } = setup({ preBar: { ...PRE_BAR, status: 'rejected' } });
  assertEquals((await quiet(() => handler(req(BODY)))).status, 400);
  assertEquals(rpcCalls.length, 0);
});

Deno.test('promoción completa: crea el bar y migra imágenes del bar y del menú', async () => {
  const { handler, rpcCalls, calls, storageCalls } = setup({
    tables: {
      auto_pre_register_bar_images: () => ({
        data: [{ file_path: 'https://x/storage/v1/object/public/bar-images/pre/1/a.jpg', image_order: 1, description: 'bar' }],
      }),
      auto_pre_register_bar_menus: () => ({ data: [{ file_path: 'pre/1/m.jpg', image_order: 1 }] }),
    },
  });
  const res = await quiet(() => handler(req(BODY)));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true, barId: 'bar-new', barImagesCount: 1, menuImagesCount: 1 });

  assertEquals(rpcCalls[0], { fn: 'promote_pre_registered_bar', args: { p_pre_bar_id: 'pre-1', p_owner_id: 'owner-1' } });
  const moves = storageCalls.filter((c) => c.method === 'move').map((c) => c.args);
  assertEquals(moves, [
    ['pre/1/a.jpg', 'bar-new/bar/a.jpg'],
    ['pre/1/m.jpg', 'bar-new/menu/m.jpg'],
  ]);
  const imgInsert = calls.find((c) => c.table === 'bar_images' && op(c, 'insert'))!;
  assertEquals(op(imgInsert, 'insert')!.args[0].image_url, 'https://test.supabase.co/storage/v1/object/public/bar-images/bar-new/bar/a.jpg');
});

Deno.test('500 si el RPC no devuelve un barId válido', async () => {
  const { handler } = setup({ rpc: () => ({ data: { nada: true } }) });
  assertEquals((await quiet(() => handler(req(BODY)))).status, 500);
});

Deno.test('si una imagen no se puede mover, sigue con las demás y no la inserta', async () => {
  const { handler, calls } = setup({
    tables: {
      auto_pre_register_bar_images: () => ({
        data: [
          { file_path: 'pre/1/roto.jpg', image_order: 1 },
          { file_path: 'pre/1/ok.jpg', image_order: 2 },
        ],
      }),
    },
    move: (from: string) => (from.includes('roto') ? { error: { message: 'not found' } } : {}),
  });
  const res = await quiet(() => handler(req(BODY)));
  assertEquals((await res.json()).barImagesCount, 1);
  assertEquals(calls.filter((c) => c.table === 'bar_images' && op(c, 'insert')).length, 1);
});

Deno.test('bar ya convertido con imágenes: no hace nada', async () => {
  const { handler, rpcCalls, storageCalls } = setup({
    preBar: { ...PRE_BAR, converted_bar_id: 'bar-9', status: 'converted' },
    tables: { bar_images: () => ({ data: [{ id: 'i' }] }) },
  });
  const res = await quiet(() => handler(req(BODY)));
  assertEquals((await res.json()).alreadyConverted, true);
  assertEquals(rpcCalls.length, 0);
  assertEquals(storageCalls.filter((c) => c.method === 'move').length, 0);
});

Deno.test('bar convertido sin imágenes: reanuda la migración sin volver a crear el bar', async () => {
  const { handler, rpcCalls } = setup({
    preBar: { ...PRE_BAR, converted_bar_id: 'bar-9', status: 'converted' },
    tables: {
      auto_pre_register_bar_images: () => ({ data: [{ file_path: 'pre/1/a.jpg', image_order: 1 }] }),
    },
  });
  const res = await quiet(() => handler(req(BODY)));
  const body = await res.json();
  assertEquals(body.barId, 'bar-9');
  assertEquals(body.barImagesCount, 1);
  assertEquals(rpcCalls.length, 0);
});
