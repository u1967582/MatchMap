import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';
import { Alert } from 'react-native';

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
        console.log('Auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session) {
          // Verify email confirmation for new registrations
          if (!session.user.email_confirmed_at && event === 'SIGNED_IN') {
            console.log('Email not confirmed yet');
            return;
          }

          // Handle OAuth user profile creation if callback provided
          if (onUserSignedIn && session.user) {
            await onUserSignedIn(session.user);
          }
          
          // User successfully signed in - redirect will be handled by layouts
          console.log('User signed in, layouts will handle redirect');
        } else if (event === 'SIGNED_OUT') {
          // User signed out - redirect will be handled by layouts
          console.log('User signed out, layouts will handle redirect');
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

export const getCurrentSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'No se pudo cerrar sesión. Inténtalo de nuevo.');
    }
    return { error };
  } catch (error) {
    console.error('Sign out error:', error);
    Alert.alert('Error', 'Error inesperado al cerrar sesión.');
    return { error };
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getCurrentSession();
  return !!session;
}; 