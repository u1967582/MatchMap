import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export default function Step0() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/register-bar/step1' as any);
  }, [router]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1C2A3A', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#FFFFFF' }}>Redirigiendo…</Text>
    </SafeAreaView>
  );
} 