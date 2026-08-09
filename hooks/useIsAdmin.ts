import { useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';

interface UseIsAdminResult {
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Comprueba si el usuario autenticado es super admin (users.is_super_user).
 * Por defecto (mientras carga o si algo falla) devuelve isAdmin=false para
 * no exponer contenido restringido a usuarios normales.
 */
export function useIsAdmin(): UseIsAdminResult {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadAdminFlag = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user) {
          if (isMounted) setIsAdmin(false);
          return;
        }

        const { data, error } = await supabase
          .from('users')
          .select('is_super_user')
          .eq('id', user.id)
          .single();

        if (!isMounted) return;

        if (error) {
          console.error('❌ Error loading admin flag:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data?.is_super_user);
        }
      } catch (error) {
        if (isMounted) {
          console.error('❌ Error loading admin flag:', error);
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAdminFlag();

    return () => {
      isMounted = false;
    };
  }, []);

  return { isAdmin, loading };
}
