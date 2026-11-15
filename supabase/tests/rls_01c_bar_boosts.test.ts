// Tests de 20261115120000_audit01c_bar_boosts_privacy.sql sobre PGlite. La tabla
// y sus políticas reproducen prod a 2026-11-15. Se ejecuta con `npm run test:functions`.
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { PGlite } from 'npm:@electric-sql/pglite@0.2.17';

const root = new URL('../', import.meta.url);
const read = (path: string) => Deno.readTextFileSync(new URL(path, root));

const STUB = read('tests/fixtures/supabase_prod_stub.sql');
const MIGRATION = read('migrations/20261115120000_audit01c_bar_boosts_privacy.sql');

const OWNER = '0b0b0b0b-0000-4000-8000-000000000001';
const OTHER = '0b0b0b0b-0000-4000-8000-000000000002';
const BAR = '0b0b0b0b-0000-4000-8000-0000000000b1';

// bar_boosts tal y como está en prod antes de la migración.
const BAR_BOOSTS_PROD = `
  CREATE POLICY test_bars_read ON public.bars FOR SELECT USING (true);

  CREATE TABLE public.bar_boosts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bar_id uuid NOT NULL REFERENCES public.bars(id) ON DELETE CASCADE,
    user_id uuid,
    plan text NOT NULL CHECK (plan IN ('7d','1m','1y')),
    start_at timestamptz NOT NULL DEFAULT now(),
    end_at timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','expired','cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    amount_cents integer NOT NULL,
    currency text NOT NULL DEFAULT 'eur',
    revenuecat_transaction_id text UNIQUE
  );
  ALTER TABLE public.bar_boosts ENABLE ROW LEVEL SECURITY;
  GRANT ALL ON public.bar_boosts TO anon, authenticated, service_role;

  CREATE POLICY "Allow all authenticated users to view active boosts" ON public.bar_boosts
    FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Bar owners can create pending boosts for their bars" ON public.bar_boosts
    FOR INSERT TO authenticated WITH CHECK (
      status = 'pending' AND user_id = (SELECT auth.uid())
      AND EXISTS (SELECT 1 FROM public.bars WHERE bars.id = bar_boosts.bar_id AND bars.owner_id = (SELECT auth.uid()))
    );
  CREATE POLICY owner_can_select_bar_boosts ON public.bar_boosts
    FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM public.bars b WHERE b.id = bar_boosts.bar_id AND b.owner_id = (SELECT auth.uid()))
    );

  -- El trigger del stub pone owner_id = auth.uid(): se inserta «como» el dueño.
  SELECT set_config('request.jwt.claims', '{"sub":"${OWNER}","role":"authenticated"}', false);
  INSERT INTO public.bars (id, name) VALUES ('${BAR}', 'Bar');
  SELECT set_config('request.jwt.claims', '', false);
  INSERT INTO public.bar_boosts (bar_id, user_id, plan, end_at, status, amount_cents, revenuecat_transaction_id) VALUES
    ('${BAR}', '${OWNER}', '1m', now() + interval '30 days', 'active', 2999, 'tx-active'),
    ('${BAR}', '${OWNER}', '7d', now() + interval '7 days', 'pending', 999, 'tx-pending');
`;

const as = (sub: string, anonymous = false) => `
  RESET ROLE;
  SELECT set_config('request.jwt.claims', '{"sub":"${sub}","role":"authenticated","is_anonymous":${anonymous}}', false);
  SET ROLE authenticated;
`;

async function freshDb(withMigration: boolean): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUB);
  await db.exec(BAR_BOOSTS_PROD);
  if (withMigration) {
    await db.exec(MIGRATION);
    await db.exec(MIGRATION); // idempotente
  }
  return db;
}

Deno.test('audit01c: sin la migración un invitado lee quién pagó y cuánto', async () => {
  const db = await freshDb(false);
  try {
    await db.exec(as(OTHER, true));
    const { rows } = await db.query<{ user_id: string; amount_cents: number }>(
      'SELECT user_id, amount_cents FROM public.bar_boosts ORDER BY amount_cents'
    );
    assertEquals(rows.length, 2);
    assertEquals(rows[1].user_id, OWNER);
  } finally {
    await db.close();
  }
});

Deno.test('audit01c: con la migración las columnas de pago no se pueden leer', async () => {
  const db = await freshDb(true);
  try {
    await db.exec(as(OTHER, true));
    for (const column of ['user_id', 'amount_cents', 'currency']) {
      await assertRejects(
        () => db.query(`SELECT ${column} FROM public.bar_boosts`),
        Error,
        'permission denied'
      );
    }
    await assertRejects(() => db.query('SELECT * FROM public.bar_boosts'), Error, 'permission denied');
  } finally {
    await db.close();
  }
});

Deno.test('audit01c: los demás solo ven boosts activos (lo que pinta el mapa)', async () => {
  const db = await freshDb(true);
  try {
    await db.exec(as(OTHER, true));
    const { rows } = await db.query<{ bar_id: string; status: string }>(
      'SELECT bar_id, end_at, status FROM public.bar_boosts'
    );
    assertEquals(rows.map((r) => r.status), ['active']);
  } finally {
    await db.close();
  }
});

Deno.test('audit01c: el dueño sigue viendo sus boosts y puede crear uno pendiente', async () => {
  const db = await freshDb(true);
  try {
    await db.exec(as(OWNER));
    const { rows } = await db.query<{ status: string }>(
      'SELECT id, plan, end_at, status FROM public.bar_boosts ORDER BY status'
    );
    assertEquals(rows.map((r) => r.status), ['active', 'pending']);

    // Mismo INSERT que hace useBoostOfferings (upsert con ignoreDuplicates).
    const upsert = `
      INSERT INTO public.bar_boosts (bar_id, user_id, plan, end_at, status, amount_cents, currency, revenuecat_transaction_id)
      VALUES ('${BAR}', '${OWNER}', '1y', now() + interval '1 year', 'pending', 9999, 'eur', 'tx-new')
      ON CONFLICT (revenuecat_transaction_id) DO NOTHING`;
    await db.exec(upsert);
    await db.exec(upsert); // repetido: no falla
    const after = await db.query('SELECT id FROM public.bar_boosts');
    assertEquals(after.rows.length, 3);
  } finally {
    await db.close();
  }
});

Deno.test('audit01c: anon no tiene ningún permiso sobre bar_boosts', async () => {
  const db = await freshDb(true);
  try {
    await db.exec('RESET ROLE; SET ROLE anon;');
    await assertRejects(
      () => db.query('SELECT id FROM public.bar_boosts'),
      Error,
      'permission denied'
    );
  } finally {
    await db.close();
  }
});
