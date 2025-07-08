import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';

export const getOAuthRedirectUrl = () => {
  if (__DEV__) {
    // Development URL for Expo
    return 'exp://localhost:8081/--/';
  } else {
    // Production URL scheme
    return 'MatchMap://';
  }
};

export const useAuthStateChange = () => {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // User successfully signed in (including OAuth) - redirect to protected map
          router.replace('/(protected)/map' as any);
        } else if (event === 'SIGNED_OUT') {
          // User signed out - redirect to home
          router.replace('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
}; 