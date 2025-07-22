import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';

interface UseSessionReturn {
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
}

export const useSession = (): UseSessionReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
        }
        setSession(session);
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    loading,
    isAuthenticated: !!session,
  };
}; 