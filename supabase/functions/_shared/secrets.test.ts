import { assertEquals } from 'jsr:@std/assert@1';
import { createFakeSupabase, quiet } from './fakeSupabase.ts';
import { createCronAuth, timingSafeEqual } from './secrets.ts';

const req = (secret?: string) =>
  new Request('http://localhost', { headers: secret ? { 'x-cron-secret': secret } : {} });

Deno.test('timingSafeEqual compara contenido y longitud', () => {
  assertEquals(timingSafeEqual('abc', 'abc'), true);
  assertEquals(timingSafeEqual('abc', 'abd'), false);
  assertEquals(timingSafeEqual('abc', 'abcd'), false);
  assertEquals(timingSafeEqual('', ''), true);
  assertEquals(timingSafeEqual(null, 'abc'), false);
  assertEquals(timingSafeEqual('abc', undefined), false);
});

Deno.test('createCronAuth: sin cabecera no consulta Vault', async () => {
  const fake = createFakeSupabase({ rpc: () => ({ data: 's1' }) });
  const auth = createCronAuth(fake.client);
  assertEquals(await auth(req()), false);
  assertEquals(fake.rpcCalls.length, 0);
});

Deno.test('createCronAuth: cachea el secreto entre peticiones', async () => {
  const fake = createFakeSupabase({ rpc: () => ({ data: 's1' }) });
  const auth = createCronAuth(fake.client);
  assertEquals(await auth(req('s1')), true);
  assertEquals(await auth(req('s1')), true);
  assertEquals(fake.rpcCalls.length, 1);
});

Deno.test('createCronAuth: tras rotar el secreto lo relee (con límite de frecuencia)', async () => {
  let secret = 's1';
  let t = 0;
  const fake = createFakeSupabase({ rpc: () => ({ data: secret }) });
  const auth = createCronAuth(fake.client, { refreshMs: 1000, now: () => t });
  assertEquals(await auth(req('s1')), true);
  secret = 's2';
  // Dentro de la ventana no relee: un secreto falso no provoca una RPC por petición
  t = 500;
  assertEquals(await auth(req('s2')), false);
  assertEquals(fake.rpcCalls.length, 1);
  // Pasada la ventana relee y acepta el nuevo
  t = 2000;
  assertEquals(await auth(req('s2')), true);
  assertEquals(await auth(req('s1')), false);
  assertEquals(fake.rpcCalls.length, 2);
});

Deno.test('createCronAuth: si Vault falla, deniega', async () => {
  const fake = createFakeSupabase({ rpc: () => ({ data: null, error: { message: 'x' } }) });
  const auth = createCronAuth(fake.client);
  assertEquals(await quiet(() => auth(req('s1'))), false);
});
