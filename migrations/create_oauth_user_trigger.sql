-- ============================================
-- MIGRACIÓN: Sistema de Creación Automática de Usuarios OAuth
-- Versión: 1.0
-- Fecha: 2025-01-01
-- Descripción: Crea automáticamente usuarios en public.users 
--              después de registro OAuth (Google, Facebook, Apple, etc.)
-- ============================================

-- ============================================
-- 1. FUNCIÓN: handle_new_oauth_user
-- ============================================
-- Esta función se ejecuta automáticamente cuando se crea un nuevo
-- usuario en auth.users y crea el registro correspondiente en public.users

CREATE OR REPLACE FUNCTION public.handle_new_oauth_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_email TEXT;
  v_full_name TEXT;
  v_username TEXT;
  v_profile_image_url TEXT;
  v_base_username TEXT;
  v_counter INTEGER := 1;
  v_username_exists BOOLEAN;
BEGIN
  -- ==========================================
  -- VERIFICACIÓN INICIAL
  -- ==========================================
  -- Solo procesar si es un nuevo usuario y no existe en public.users
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RAISE NOTICE 'Usuario ya existe en public.users: %', NEW.email;
    RETURN NEW;
  END IF;

  -- Verificar que el email no sea nulo
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RAISE WARNING 'Intento de crear usuario sin email: user_id=%', NEW.id;
    RETURN NEW;
  END IF;

  -- ==========================================
  -- EXTRAER DATOS DEL PERFIL OAUTH
  -- ==========================================
  
  v_email := NEW.email;
  
  -- Obtener nombre completo del metadata (varía según provider)
  -- Google: "full_name" o "name"
  -- Facebook: "full_name" o "name"
  -- Apple: "full_name"
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'display_name',
    '' -- Default vacío si no hay nombre
  );
  
  -- Obtener imagen de perfil (varía según provider)
  -- Google: "picture" o "avatar_url"
  -- Facebook: "picture" -> "data" -> "url" (más complejo)
  -- Apple: no provee imagen
  v_profile_image_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'photo_url',
    NEW.raw_user_meta_data->'picture'->'data'->>'url', -- Facebook nested
    NULL
  );

  -- Limpiar la URL si es muy larga o no es válida
  IF v_profile_image_url IS NOT NULL AND LENGTH(v_profile_image_url) > 500 THEN
    v_profile_image_url := SUBSTRING(v_profile_image_url, 1, 500);
  END IF;

  -- ==========================================
  -- GENERACIÓN DE USERNAME ÚNICO
  -- ==========================================
  
  -- Estrategia 1: Usar el primer nombre
  IF v_full_name IS NOT NULL AND v_full_name != '' THEN
    -- Tomar el primer nombre (antes del primer espacio)
    v_base_username := LOWER(TRIM(SPLIT_PART(v_full_name, ' ', 1)));
    
    -- Quitar caracteres especiales y acentos
    v_base_username := REGEXP_REPLACE(v_base_username, '[^a-zA-Z0-9_]', '', 'g');
    
    -- Remover underscores del inicio y final
    v_base_username := TRIM(BOTH '_' FROM v_base_username);
  END IF;
  
  -- Estrategia 2: Si no hay nombre válido, usar parte del email
  IF v_base_username IS NULL OR v_base_username = '' OR LENGTH(v_base_username) < 3 THEN
    -- Tomar parte antes del @ del email
    v_base_username := LOWER(SPLIT_PART(v_email, '@', 1));
    v_base_username := REGEXP_REPLACE(v_base_username, '[^a-zA-Z0-9_]', '', 'g');
    v_base_username := TRIM(BOTH '_' FROM v_base_username);
  END IF;

  -- Estrategia 3: Fallback a username genérico
  IF v_base_username IS NULL OR v_base_username = '' OR LENGTH(v_base_username) < 3 THEN
    -- Usar 'user' + hash del email
    v_base_username := 'user' || SUBSTRING(MD5(v_email), 1, 8);
  END IF;

  -- Limitar longitud del base username
  IF LENGTH(v_base_username) > 20 THEN
    v_base_username := SUBSTRING(v_base_username, 1, 20);
  END IF;

  -- ==========================================
  -- ASEGURAR UNICIDAD DEL USERNAME
  -- ==========================================
  
  -- Intentar con el username base primero
  v_username := v_base_username;
  
  -- Loop para encontrar username disponible
  LOOP
    -- Verificar si el username ya existe
    SELECT EXISTS(
      SELECT 1 FROM public.users WHERE username = v_username
    ) INTO v_username_exists;
    
    -- Si no existe, salir del loop
    EXIT WHEN NOT v_username_exists;
    
    -- Si existe, agregar sufijo numérico
    v_username := v_base_username || v_counter::TEXT;
    v_counter := v_counter + 1;
    
    -- Prevenir loop infinito (máximo 9999 intentos)
    IF v_counter > 9999 THEN
      -- Fallback: usar random hash
      v_username := v_base_username || '_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
      EXIT;
    END IF;
  END LOOP;

  -- ==========================================
  -- INSERTAR NUEVO USUARIO
  -- ==========================================
  
  BEGIN
    INSERT INTO public.users (
      id,
      email,
      username,
      full_name,
      profile_image_url,
      is_bar_owner,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,                -- UUID del usuario de auth.users
      v_email,               -- Email del perfil OAuth
      v_username,            -- Username único generado
      v_full_name,           -- Nombre completo del perfil
      v_profile_image_url,   -- Foto de perfil (puede ser NULL)
      false,                 -- Por defecto no es dueño de bar
      NOW(),                 -- Fecha de creación
      NOW()                  -- Fecha de actualización
    );

    -- Log exitoso para debugging
    RAISE NOTICE 'Usuario OAuth creado exitosamente: id=%, email=%, username=%, full_name=%', 
      NEW.id, v_email, v_username, v_full_name;
    
  EXCEPTION WHEN OTHERS THEN
    -- Si falla la inserción, registrar el error pero no fallar el auth
    RAISE WARNING 'Error al insertar usuario en public.users: % - SQLSTATE: %', 
      SQLERRM, SQLSTATE;
    
    -- Intentar registrar el error en una tabla de logs si existe
    BEGIN
      INSERT INTO public.auth_errors (user_id, error_message, error_state, created_at)
      VALUES (NEW.id, SQLERRM, SQLSTATE, NOW());
    EXCEPTION WHEN OTHERS THEN
      -- Si no existe tabla de logs, ignorar
      NULL;
    END;
  END;

  RETURN NEW;
  
END;
$$;

-- ==========================================
-- COMENTARIOS Y METADATA
-- ==========================================

COMMENT ON FUNCTION public.handle_new_oauth_user() IS 
'Crea automáticamente un registro en public.users cuando un usuario se registra vía OAuth.
Extrae datos del raw_user_meta_data (nombre, foto) y genera un username único.
Ejecutado por trigger on_auth_user_created.';

-- ==========================================
-- 2. TRIGGER: on_auth_user_created
-- ==========================================

-- Eliminar trigger anterior si existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Crear nuevo trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_oauth_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
'Trigger que ejecuta handle_new_oauth_user() después de cada INSERT en auth.users.
Crea automáticamente el usuario en public.users con datos del perfil OAuth.';

-- ==========================================
-- 3. PERMISOS Y SEGURIDAD
-- ==========================================

-- Otorgar permisos de ejecución a roles necesarios
GRANT EXECUTE ON FUNCTION public.handle_new_oauth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_oauth_user() TO service_role;

-- ==========================================
-- 4. TABLA DE LOGS DE ERRORES (OPCIONAL)
-- ==========================================

-- Crear tabla para registrar errores de autenticación (opcional)
CREATE TABLE IF NOT EXISTS public.auth_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  error_message TEXT,
  error_state TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.auth_errors IS 
'Tabla de logs para errores durante la creación de usuarios OAuth.
Útil para debugging y monitoreo.';

-- Índice para búsquedas por user_id
CREATE INDEX IF NOT EXISTS idx_auth_errors_user_id ON public.auth_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_errors_created_at ON public.auth_errors(created_at DESC);

-- ==========================================
-- 5. VERIFICACIÓN Y TESTING
-- ==========================================

-- Query para verificar que el trigger existe
-- Ejecuta esto para confirmar la instalación:
/*
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'on_auth_user_created';
*/

-- Query para ver usuarios OAuth recientes
/*
SELECT 
  au.id,
  au.email,
  au.created_at AS auth_created,
  pu.username,
  pu.full_name,
  pu.profile_image_url,
  pu.created_at AS public_created
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC
LIMIT 10;
*/

-- Query para detectar usuarios en auth pero no en public
/*
SELECT 
  au.id,
  au.email,
  au.created_at,
  au.raw_user_meta_data
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ORDER BY au.created_at DESC;
*/

-- ==========================================
-- MIGRACIÓN COMPLETADA
-- ==========================================

RAISE NOTICE '
============================================
✅ Migración OAuth User Trigger Completada
============================================
- Función: handle_new_oauth_user() creada
- Trigger: on_auth_user_created creado
- Permisos: otorgados correctamente
- Tabla de logs: auth_errors creada

Próximos pasos:
1. Testear login con Google OAuth
2. Verificar que el usuario se crea en public.users
3. Revisar que username sea único
4. Confirmar que foto y nombre se guardan

Para debugging, revisa:
- SELECT * FROM public.auth_errors; (errores)
- Ver queries de verificación arriba
============================================
';

