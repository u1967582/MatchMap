import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';

export const getOAuthRedirectUrl = (): string => {
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

export async function signInWithApple() {
  const isAvailable = await AppleAuthentication.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Apple Sign-In no está disponible en este dispositivo.');
  }

  const rawNonceBytes = await Crypto.getRandomBytesAsync(16);
  const rawNonce = Array.from(rawNonceBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('No se recibió identityToken de Apple.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;
  return data;
}