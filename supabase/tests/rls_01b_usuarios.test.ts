// Tests de 20261105120000_audit01b_users_privacy.sql sobre PGlite. Mismo patrón
// que rls_01_seguridad.test.ts. Se ejecuta con `npm run test:functions`.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

const root = new URL('../', import.meta.url);
const read = (path: string) => Deno.readTextFileSync(new URL(path, root));

const STUB = read('tests/fixtures/supabase_prod_stub.sql');
const USERS_PROD = read('tests/fixtures/users_prod_policies.sql');
const MIGRATION = read('migrations/20261105120000_audit01b_users_privacy.sql');
const RLS_SCRIPT = read('tests/rls_01b_usuarios.sql');

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB);
  await db.exec(USERS_PROD);
  return db;
}

Deno.test('audit01b: sin la migración el script detecta la fuga de prod', async () => {
  const db = await freshDb();
  try {
    await assertRejects(() => db.exec(RLS_SCRIPT), Error, 'AUDIT01B FAIL');
  } finally {
    await db.close();
  }
});

const GUEST = '0a0a0a0a-0000-4000-8000-0000000e0005';
const ESCALATE = `
  SET ROLE anon;
  INSERT INTO public.users (id, email, username, is_super_user)
  VALUES ('${GUEST}', 'x@example.invalid', 'x', true);
`;

Deno.test('audit01b: sin la migración un invitado se hace super admin con el rol anon', async () => {
  const db = await freshDb();
  try {
    await db.exec(ESCALATE);
    await db.exec(`
      RESET ROLE;
      SELECT set_config('request.jwt.claims', '{"sub":"${GUEST}","role":"authenticated","is_anonymous":true}', false);
      SET ROLE authenticated;
    `);
    const { rows } = await db.query<{ admin: boolean }>('SELECT public.is_super_admin() AS admin');
    assertEquals(rows[0].admin, true);
  } finally {
    await db.close();
  }
});

Deno.test('audit01b: con la migración ese mismo INSERT se rechaza', async () => {
  const db = await freshDb();
  try {
    await db.exec(MIGRATION);
    await assertRejects(() => db.exec(ESCALATE), Error, 'permission denied');
  } finally {
    await db.close();
  }
});

Deno.test('audit01b: la migración es idempotente y el script pasa', async () => {
  const db = await freshDb();
  try {
    await db.exec(MIGRATION);
    await db.exec(MIGRATION);
    const results = await db.exec(RLS_SCRIPT);
    const ok = results.some((r) =>
      r.rows.some((row) => (row as Record<string, unknown>).resultado === 'AUDIT01B RLS OK')
    );
    assert(ok, "el script no llegó a 'AUDIT01B RLS OK'");
  } finally {
    await db.close();
  }
});

Deno.test('audit01b: public_profiles solo expone a quien ha publicado reseña, sin email', async () => {
  const db = await freshDb();
  try {
    await db.exec(MIGRATION);
    await db.exec(`
      INSERT INTO public.users (id, email, username) VALUES
        ('0a0a0a0a-0000-4000-8000-0000000e0001', 'con-resena@example.invalid', 'con_resena'),
        ('0a0a0a0a-0000-4000-8000-0000000e0002', 'sin-resena@example.invalid', 'sin_resena');
      INSERT INTO public.reviews (user_id, rating) VALUES ('0a0a0a0a-0000-4000-8000-0000000e0001', 5);
      SET ROLE authenticated;
    `);
    const { rows, fields } = await db.query<{ username: string }>('SELECT * FROM public.public_profiles');
    assertEquals(rows.map((r) => r.username), ['con_resena']);
    assertEquals(fields.map((f) => f.name).sort(), ['id', 'profile_image_url', 'username']);
  } finally {
    await db.close();
  }
});
