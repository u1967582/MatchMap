// Tests de la migración de seguridad de la auditoría 01 (RLS y Storage).
//
// Ejecuta en un Postgres embebido (PGlite, WASM) una réplica mínima de prod
// (fixtures/supabase_prod_stub.sql), aplica la migración dos veces
// (idempotencia) y lanza supabase/tests/rls_01_seguridad.sql, el mismo script
// que se ejecuta después contra prod en modo BEGIN … ROLLBACK.
//
// Se ejecuta con `npm run test:functions` (incluido en `npm run test:all`).
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

const root = new URL('../', import.meta.url);
const read = (path: string) => Deno.readTextFileSync(new URL(path, root));

const STUB = read('tests/fixtures/supabase_prod_stub.sql');
const MIGRATION = read('migrations/20261015120000_audit01_security_rls_storage.sql');
const RLS_SCRIPT = read('tests/rls_01_seguridad.sql');

async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB);
  return db;
}

Deno.test('audit01: la migración es idempotente y el script de RLS pasa', async () => {
  const db = await freshDb();
  try {
    await db.exec(MIGRATION);
    await db.exec(MIGRATION);
    const results = await db.exec(RLS_SCRIPT);
    const ok = results.some((r) =>
      r.rows.some((row) => (row as Record<string, unknown>).resultado === 'AUDIT01 RLS OK')
    );
    assert(ok, "el script no llegó a 'AUDIT01 RLS OK'");
  } finally {
    await db.close();
  }
});

Deno.test('audit01: sin la migración el script detecta los agujeros de prod', async () => {
  const db = await freshDb();
  try {
    await assertRejects(() => db.exec(RLS_SCRIPT), Error, 'AUDIT01 FAIL');
  } finally {
    await db.close();
  }
});

Deno.test('audit01: el propietario puede subir fotos a la carpeta de su bar', async () => {
  // Regresión: dentro del EXISTS sobre public.bars, "name" sin calificar es
  // bars.name y no storage.objects.name, y ningún dueño podía subir fotos.
  const db = await freshDb();
  try {
    await db.exec(MIGRATION);
    await db.exec(`
      BEGIN;
      SELECT set_config('request.jwt.claims',
        '{"sub":"0a0a0a0a-0000-4000-8000-00000000c0de","role":"authenticated"}', true);
      INSERT INTO public.bars (id, name) VALUES ('0b0b0b0b-0000-4000-8000-00000000c0de', 'Bar');
      SET LOCAL ROLE authenticated;
      INSERT INTO storage.objects (bucket_id, name)
      VALUES ('bar-images', '0b0b0b0b-0000-4000-8000-00000000c0de/bar/bar_0_1.jpg'),
             ('bar-images', '0b0b0b0b-0000-4000-8000-00000000c0de/menu/menu_0_1.jpg'),
             ('bar-images', '0b0b0b0b-0000-4000-8000-00000000c0de/posts/post_p_1.jpg');
    `);
    const { rows } = await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM storage.objects WHERE bucket_id = 'bar-images'"
    );
    assertEquals(rows[0].n, 3);
    await db.exec('ROLLBACK');
  } finally {
    await db.close();
  }
});

Deno.test('audit01: no toca la migración destructiva de bufandas', () => {
  assert(!MIGRATION.includes('drop_scarves_collectibles'));
  assert(!/DROP\s+TABLE/i.test(MIGRATION), 'la migración no debe borrar tablas');
});
