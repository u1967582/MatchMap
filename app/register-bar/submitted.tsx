import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterBarSubmittedScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId?: string }>();

  const canViewBar = useMemo(() => typeof barId === 'string' && barId.length > 0, [barId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verificación</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={28} color="#FFD700" />
          </View>

          <Text style={styles.title}>Bar enviado para verificación</Text>
          <Text style={styles.subtitle}>
            En cuanto lo aprobemos, aparecerá en el mapa y en la búsqueda.
          </Text>

          <View style={styles.badge}>
            <Ionicons name="alert-circle-outline" size={16} color="#FFD700" />
            <Text style={styles.badgeText}>Pendiente de verificación</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.primaryButton}
            onPress={() => router.replace('/(protected)/profile' as any)}
          >
            <Text style={styles.primaryButtonText}>Volver al perfil</Text>
          </TouchableOpacity>

          {canViewBar ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.secondaryButton}
              onPress={() => router.replace(`/bar-profile/${barId}` as any)}
            >
              <Text style={styles.secondaryButtonText}>Ver mi bar</Text>
              <Ionicons name="chevron-forward" size={16} color="#A3B3CC" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C2A3A',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: Platform.OS === 'android' ? 6 : 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.22)',
    marginBottom: 14,
  },
  badgeText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButtonText: {
    color: '#A3B3CC',
    fontSize: 14,
    fontWeight: '700',
  },
});


