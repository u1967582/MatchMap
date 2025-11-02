-- ============================================
-- MIGRACIÓN: Arreglar RLS Policies para Bar Boosts
-- Versión: 1.0
-- Fecha: 2025-01-02
-- Descripción: Permite a todos los usuarios autenticados ver 
--              los bares con boost activo (incluidos usuarios OAuth)
-- ============================================

-- ============================================
-- 1. VERIFICAR POLÍTICAS EXISTENTES
-- ============================================

-- Ver políticas actuales en bar_boosts
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'bar_boosts';

-- ============================================
-- 2. ELIMINAR POLÍTICAS RESTRICTIVAS (SI EXISTEN)
-- ============================================

-- Eliminar políticas antiguas que puedan estar bloqueando
DROP POLICY IF EXISTS "Users can view active boosts" ON bar_boosts;
DROP POLICY IF EXISTS "Bar owners can view their boosts" ON bar_boosts;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON bar_boosts;
DROP POLICY IF EXISTS "Enable read access for all users" ON bar_boosts;

-- ============================================
-- 3. CREAR POLÍTICA PERMISIVA PARA LECTURA
-- ============================================

-- Permitir a TODOS los usuarios autenticados ver boosts activos
CREATE POLICY "Allow all authenticated users to view active boosts"
ON bar_boosts
FOR SELECT
TO authenticated
USING (true);

-- Comentario explicativo
COMMENT ON POLICY "Allow all authenticated users to view active boosts" ON bar_boosts IS
'Permite a todos los usuarios autenticados (email/password y OAuth) ver los boosts activos.
Necesario para que los marcadores boosted aparezcan en el mapa.';

-- ============================================
-- 4. VERIFICAR POLÍTICAS EN TABLA BARS
-- ============================================

-- Ver políticas actuales en bars
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'bars';

-- Si no existe política de lectura para bars, crearla
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON bars;
DROP POLICY IF EXISTS "Allow all authenticated users to view bars" ON bars;

CREATE POLICY "Allow all authenticated users to view bars"
ON bars
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "Allow all authenticated users to view bars" ON bars IS
'Permite a todos los usuarios autenticados ver todos los bares.
Incluye usuarios OAuth (Google, Facebook, etc.)';

-- ============================================
-- 5. ASEGURAR QUE RLS ESTÉ HABILITADO
-- ============================================

-- Habilitar RLS en bar_boosts (si no está habilitado)
ALTER TABLE bar_boosts ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS en bars (si no está habilitado)
ALTER TABLE bars ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. VERIFICAR QUE TODO FUNCIONA
-- ============================================

-- Query de prueba 1: Ver boosts activos como usuario autenticado
-- Ejecuta esto después de hacer login:
/*
SELECT 
  bb.id,
  bb.bar_id,
  bb.status,
  bb.end_at,
  b.name as bar_name,
  b.latitude,
  b.longitude
FROM bar_boosts bb
JOIN bars b ON bb.bar_id = b.id
WHERE bb.status = 'active'
  AND bb.end_at > NOW()
ORDER BY bb.created_at DESC
LIMIT 10;
*/

-- Query de prueba 2: Ver usuario actual y sus permisos
/*
SELECT 
  au.id,
  au.email,
  au.created_at,
  pu.username,
  pu.full_name,
  pu.is_bar_owner
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE au.id = auth.uid();
*/

-- ============================================
-- 7. POLÍTICAS ADICIONALES PARA ESCRITURA
-- ============================================

-- Solo los dueños de bares pueden crear/modificar boosts
DROP POLICY IF EXISTS "Bar owners can create boosts" ON bar_boosts;
DROP POLICY IF EXISTS "Bar owners can update their boosts" ON bar_boosts;

-- Crear boost (solo dueños del bar)
CREATE POLICY "Bar owners can create boosts for their bars"
ON bar_boosts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
);

-- Actualizar boost (solo dueños del bar)
CREATE POLICY "Bar owners can update their bar boosts"
ON bar_boosts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bars
    WHERE bars.id = bar_boosts.bar_id
      AND bars.owner_id = auth.uid()
  )
);

-- ============================================
-- 8. GRANTS NECESARIOS
-- ============================================

-- Asegurar que el rol authenticated puede leer
GRANT SELECT ON bar_boosts TO authenticated;
GRANT SELECT ON bars TO authenticated;

-- Solo lectura para tablas relacionadas
GRANT SELECT ON bar_images TO authenticated;
GRANT SELECT ON bar_categories TO authenticated;
GRANT SELECT ON categories TO authenticated;

-- ============================================
-- MIGRACIÓN COMPLETADA
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '
============================================
✅ Migración RLS Boost Policies Completada
============================================
- Políticas antiguas eliminadas
- Nueva política de lectura creada
- Todos los usuarios autenticados pueden ver boosts
- Solo dueños de bares pueden crear/modificar boosts
- RLS habilitado en bar_boosts y bars

Próximos pasos:
1. Hacer login con usuario OAuth (Google)
2. Verificar que aparecen marcadores boosted en el mapa
3. Revisar query de prueba arriba

Para debugging:
- SELECT * FROM pg_policies WHERE tablename = ''bar_boosts'';
- Ver logs en Supabase Dashboard → Logs → Postgres
============================================
';
END $$;

