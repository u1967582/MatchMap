import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { supabase } from '~/utils/supabase';

export default function Reset() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async (url?: string | null) => {
      try {
        const effectiveUrl = url ?? (await Linking.getInitialURL());
        if (!effectiveUrl) {
          setErrorMsg('Enlace no disponible');
          return;
        }

        // Try to get ?code= from query
        const parsed = Linking.parse(effectiveUrl);
        const code = (parsed.queryParams?.code as string) || undefined;
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession({ code });
          if (error) throw error;
          router.replace('/set-new-password');
          return;
        }

        // Try token_hash flow (?token_hash=...&type=recovery&email=...)
        const token_hash = (parsed.queryParams?.token_hash as string) || undefined;
        const email = (parsed.queryParams?.email as string) || undefined;
        const typeParam = (parsed.queryParams?.type as string) || undefined;
        if (token_hash && email && (typeParam === 'recovery' || typeParam === 'email')) {
          const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash, email });
          if (error) throw error;
          router.replace('/set-new-password');
          return;
        }

        // Fallback: parse hash for access_token/refresh_token (Supabase sometimes uses fragment)
        const hash = effectiveUrl.split('#')[1];
        if (hash) {
          const params = new URLSearchParams(hash);
          const access_token = params.get('access_token') || undefined;
          const refresh_token = params.get('refresh_token') || undefined;
          const type = params.get('type');
          if (access_token && refresh_token && (type === 'recovery' || type === 'signup' || type === 'magiclink')) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            router.replace('/set-new-password');
            return;
          }
        }

        setErrorMsg('Código de recuperación no encontrado');
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'No se pudo abrir el enlace de recuperación');
      }
    };

    // Handle initial URL
    handleUrl();
    // Also handle when app is already open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {errorMsg ? (
        <Text style={styles.text}>{errorMsg}</Text>
      ) : (
        <>
          <ActivityIndicator />
          <Text style={[styles.text, { marginTop: 8 }]}>Abriendo enlace…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1C2A3A', alignItems: 'center', justifyContent: 'center', padding: 16 },
  text: { color: '#FFFFFF' }
});


