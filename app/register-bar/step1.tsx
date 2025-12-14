import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import Step1GeneralInfo from '~/screens/registerBar/Step1GeneralInfo';

// Plans removed: helper no longer needed

export default function Step1() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [user, setUser] = useState<any>(null);
  const [canProceed, setCanProceed] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if this is auto pre-register mode (super user cold registration)
  const isAutoPreRegister = mode === 'auto_pre_register';

  useEffect(() => {
    const getUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        
        // All users can proceed directly
        setCanProceed(true);
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
    return <Step1GeneralInfo isAutoPreRegister={isAutoPreRegister} />;
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