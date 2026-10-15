-- Rendimiento de la BD (HALLAZGOS_2026-10-10 #21, área 07 de la auditoría).
--
-- Resuelve los avisos del advisor de rendimiento de Supabase:
--   1. auth_rls_initplan      → envolver auth.uid()/auth.jwt()/auth.role() en
--                                (select …) en las políticas de `public`.
--   2. duplicate_index        → borrar índices idénticos duplicados.
--   3. unindexed_foreign_keys → crear índice para las FKs sin índice.
--   (unused_index NO se toca aquí: ver docs/audit/areas/07-backend.md.)
--
-- Es genérica (lee el catálogo) porque el esquema base de prod no está
-- entero en el repo. Es idempotente: volver a ejecutarla no cambia nada.
--
-- ⚠️ Aplicar DESPUÉS de la migración de seguridad del área 01 (políticas
-- legacy, Storage): así solo se reescriben las políticas que sobrevivan.
-- No toca el esquema `storage` ni cambia la semántica de ninguna política:
-- `(select auth.uid())` devuelve lo mismo que `auth.uid()`, pero el planner
-- lo evalúa una vez por consulta (InitPlan) en vez de una vez por fila.
--
-- Comprobación antes de aplicar en prod (💻): ejecutar el fichero dentro de
-- BEGIN; … ROLLBACK; y revisar los NOTICE que emite.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. auth_rls_initplan
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.wrap_auth_calls(expr text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  fn text;
  wrapped text;
  marker text;
BEGIN
  IF expr IS NULL THEN
    RETURN NULL;
  END IF;
  FOREACH fn IN ARRAY ARRAY['uid', 'jwt', 'role'] LOOP
    -- Así deparsea Postgres una llamada ya envuelta: ( SELECT auth.uid() AS uid)
    wrapped := format('( SELECT auth.%s() AS %s)', fn, fn);
    marker := format('__mm_wrapped_auth_%s__', fn);
    expr := replace(expr, wrapped, marker);
    expr := replace(expr, format('auth.%s()', fn), wrapped);
    expr := replace(expr, marker, wrapped);
  END LOOP;
  RETURN expr;
END;
$$;

DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ~ 'auth\.(uid|jwt|role)\(\)' OR with_check ~ 'auth\.(uid|jwt|role)\(\)')
  LOOP
    new_qual := pg_temp.wrap_auth_calls(p.qual);
    new_check := pg_temp.wrap_auth_calls(p.with_check);

    IF new_qual IS NOT DISTINCT FROM p.qual AND new_check IS NOT DISTINCT FROM p.with_check THEN
      CONTINUE; -- ya estaba envuelta
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    RAISE NOTICE 'initplan: %.% → %', p.tablename, p.policyname, stmt;
    EXECUTE stmt;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. duplicate_index: mismo tabla, columnas, opclass, orden, expresiones y
--    predicado. Se conserva el que respalda una constraint (PK/UNIQUE) o, si
--    ninguno lo hace, el de nombre menor; nunca se borra uno de constraint.
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  d record;
BEGIN
  FOR d IN
    WITH idx AS (
      SELECT
        i.indexrelid,
        i.indrelid,
        c.relname AS index_name,
        n.nspname AS schema_name,
        EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid) AS backs_constraint,
        (i.indrelid::text || ' ' || i.indkey::text || ' ' || i.indclass::text || ' ' ||
         i.indcollation::text || ' ' || i.indoption::text || ' ' || i.indisunique::text || ' ' ||
         coalesce(pg_get_expr(i.indexprs, i.indrelid), '') || ' ' ||
         coalesce(pg_get_expr(i.indpred, i.indrelid), '')) AS signature
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND i.indisvalid
    ),
    ranked AS (
      SELECT *,
        row_number() OVER (
          PARTITION BY signature
          ORDER BY backs_constraint DESC, index_name
        ) AS rn
      FROM idx
    )
    SELECT schema_name, index_name
    FROM ranked
    WHERE rn > 1 AND NOT backs_constraint
  LOOP
    RAISE NOTICE 'duplicate_index: DROP INDEX %.%', d.schema_name, d.index_name;
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', d.schema_name, d.index_name);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. unindexed_foreign_keys: índice btree con las columnas de la FK como
--    prefijo. Las tablas de MatchMap son pequeñas: CREATE INDEX normal (no
--    CONCURRENTLY, que no puede ir dentro de la transacción de la migración).
-- ─────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fk record;
  idx_name text;
BEGIN
  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      t.relname AS table_name,
      k.conname,
      k.conkey,
      (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY x.ord)
         FROM unnest(k.conkey) WITH ORDINALITY AS x(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.attnum) AS cols,
      (SELECT string_agg(a.attname, '_' ORDER BY x.ord)
         FROM unnest(k.conkey) WITH ORDINALITY AS x(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.attnum) AS cols_name
    FROM pg_constraint k
    JOIN pg_class t ON t.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE k.contype = 'f'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index i
        WHERE i.indrelid = k.conrelid
          AND i.indisvalid
          AND i.indpred IS NULL
          -- las columnas de la FK son el prefijo del índice (en cualquier orden)
          -- (indkey es int2vector, indexado desde 0)
          AND (SELECT array_agg(i.indkey[s] ORDER BY i.indkey[s])
                 FROM generate_series(0, array_length(k.conkey, 1) - 1) AS s)
              = (SELECT array_agg(v ORDER BY v) FROM unnest(k.conkey) AS v)
      )
  LOOP
    idx_name := left(format('idx_%s_%s', fk.table_name, fk.cols_name), 63);
    RAISE NOTICE 'unindexed_fk: %.% (%) → CREATE INDEX %', fk.table_name, fk.conname, fk.cols, idx_name;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
                   idx_name, fk.schema_name, fk.table_name, fk.cols);
  END LOOP;
END $$;
