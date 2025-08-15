import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import Step1GeneralInfo from '~/screens/registerBar/Step1GeneralInfo';

// helper
async function userHasActiveSubscription(userId: string) {
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['active','trialing'])
    .limit(1);
  return !!data?.length;
}

export default function Step1() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [canProceed, setCanProceed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        
        // guard global del wizard
        // ✅ Permite avanzar si:
        //   - hay subs activa, o
        //   - NO hay subs (modo free)
        const hasSubscription = await userHasActiveSubscription(currentUser.id);
        setCanProceed(hasSubscription || true);
        setIsLoading(false);
      } else {
        router.replace('/login');
      }
    };
    getUser();
  }, [router]);

  // Si está cargando, mostrar loading
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Ionicons name="refresh" size={48} color="#10B981" />
          <Text style={styles.loadingText}>Verificando acceso...</Text>
        </View>
      </View>
    );
  }

  // Si puede proceder, mostrar el formulario
  if (canProceed) {
    return <Step1GeneralInfo />;
  }

  // Fallback (no debería llegar aquí)
  return (
    <View style={styles.container}>
      <View style={styles.loadingContainer}>
        <Ionicons name="warning" size={48} color="#F59E0B" />
        <Text style={styles.loadingText}>Error de acceso</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
}); 