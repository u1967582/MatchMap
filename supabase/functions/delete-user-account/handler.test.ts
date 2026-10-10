// deno-lint-ignore-file no-explicit-any
import { assertEquals } from 'jsr:@std/assert@1';
import { createFakeSupabase, quiet } from '../_shared/fakeSupabase.ts';
import { createHandler } from './handler.ts';

const USER = { id: 'user-1', email: 'a@b.com' };

function setup(opts: Parameters<typeof createFakeSupabase>[0] = {}) {
  const fake = createFakeSupabase({
    getUser: (token) => ({ data: { user: token === 'good-token' ? USER : null } }),
    rpc: () => ({ data: ['bar-1'] }),
    ...opts,
  });
  const deleted: string[] = [];
  const origDelete = fake.client.auth.admin.deleteUser;
  fake.client.auth.admin.deleteUser = (id: string) => {
    deleted.push(id);
    return origDelete(id);
  };
  return { ...fake, deleted, handler: createHandler({ getClient: () => fake.client }) };
}

const req = (token: string | null, body: any = {}) =>
  new Request('http://localhost/delete-user-account', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  });

Deno.test('401 sin Authorization', async () => {
  const { handler, rpcCalls } = setup();
  assertEquals((await handler(req(null))).status, 401);
  assertEquals(rpcCalls.length, 0);
});

Deno.test('401 con token inválido', async () => {
  const { handler, rpcCalls, deleted } = setup();
  assertEquals((await handler(req('bad-token'))).status, 401);
  assertEquals(rpcCalls.length, 0);
  assertEquals(deleted, []);
});

Deno.test('403 si el body pide borrar a otro usuario', async () => {
  const { handler, rpcCalls, deleted } = setup();
  const res = await handler(req('good-token', { userId: 'victima' }));
  assertEquals(res.status, 403);
  assertEquals(rpcCalls.length, 0);
  assertEquals(deleted, []);
});

Deno.test('borra SIEMPRE al usuario del JWT: datos, storage y auth', async () => {
  const { handler, rpcCalls, deleted, storageCalls } = setup();
  const res = await quiet(() => handler(req('good-token', { userId: 'user-1' })));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(rpcCalls, [{ fn: 'delete_user_data', args: { p_user_id: 'user-1' } }]);
  assertEquals(deleted, ['user-1']);
  const listed = storageCalls.filter((c) => c.method === 'list').map((c) => `${c.bucket}:${c.args[0]}`);
  for (const expected of ['avatars:user-1', 'bar-claim-documents:user-1', 'ticket-claims:user-1', 'bar-images:bar-1']) {
    assertEquals(listed.includes(expected), true, `falta listar ${expected}`);
  }
});

Deno.test('funciona sin body (clientes nuevos)', async () => {
  const { handler, deleted } = setup();
  const r = new Request('http://localhost', { method: 'POST', headers: { Authorization: 'Bearer good-token' } });
  assertEquals((await quiet(() => handler(r))).status, 200);
  assertEquals(deleted, ['user-1']);
});

Deno.test('borra recursivamente las carpetas del storage (id === null)', async () => {
  const { handler, storageCalls } = setup({
    storage: {
      list: (bucket, prefix) => {
        if (bucket === 'bar-images' && prefix === 'bar-1') {
          return { data: [{ name: 'menu', id: null }, { name: 'a.jpg', id: '1' }] };
        }
        if (bucket === 'bar-images' && prefix === 'bar-1/menu') {
          return { data: [{ name: 'm.jpg', id: '2' }] };
        }
        if (bucket === 'bar-images' && prefix === '') {
          return { data: [{ name: 'bar-bar-1-x.jpg', id: '3' }] };
        }
        return { data: [] };
      },
    },
  });
  await quiet(() => handler(req('good-token')));
  const removed = storageCalls.filter((c) => c.method === 'remove').flatMap((c) => c.args[0]);
  assertEquals(removed.sort(), ['bar-1/a.jpg', 'bar-1/menu/m.jpg', 'bar-bar-1-x.jpg'].sort());
});

Deno.test('un fallo del storage no impide borrar la cuenta', async () => {
  const { handler, deleted } = setup({
    storage: { list: () => { throw new Error('storage caído'); } },
  });
  const res = await quiet(() => handler(req('good-token')));
  assertEquals(res.status, 200);
  assertEquals(deleted, ['user-1']);
});

Deno.test('500 y NO borra el usuario de auth si falla delete_user_data', async () => {
  const { handler, deleted } = setup({ rpc: () => ({ data: null, error: { message: 'fk' } }) });
  const res = await quiet(() => handler(req('good-token')));
  assertEquals(res.status, 500);
  assertEquals(deleted, []);
});

Deno.test('500 si falla el borrado del usuario de auth', async () => {
  const { handler } = setup({ deleteUser: () => ({ error: { message: 'x' } }) });
  const res = await quiet(() => handler(req('good-token')));
  assertEquals(res.status, 500);
  assertEquals((await res.json()).success, false);
});
