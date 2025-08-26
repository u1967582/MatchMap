import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
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

export const useAuthStateChange = (onUserSignedIn?: (user: any) => Promise<void>) => {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Handle OAuth user profile creation if callback provided
          if (onUserSignedIn && session.user) {
            await onUserSignedIn(session.user);
          }
          // User successfully signed in (including OAuth) - redirect to protected map
          router.replace('/(protected)/map' as any);
        } else if (event === 'SIGNED_OUT') {
          // User signed out - redirect to home
          router.replace('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, onUserSignedIn]);
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
}; 

// iOS-friendly Google OAuth using AuthSession redirect (matchmap://auth)
WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  const redirectTo = makeRedirectUri({ scheme: 'matchmap' });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  return data;
}