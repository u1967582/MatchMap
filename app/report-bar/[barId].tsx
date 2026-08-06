import React, { useEffect, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import {
  AppText,
  AppButton,
  AppChip,
  toast,
  colors,
  spacing,
  radius,
} from '~/components/ds';

interface BarSummary {
  id: string;
  name: string;
  address?: string;
  city?: string;
}

type ReportReason = 'info_incorrecta' | 'cerrado' | 'ubicacion_incorrecta' | 'fotos_incorrectas' | 'otro';

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'info_incorrecta', label: 'Información incorrecta' },
  { value: 'cerrado', label: 'Ha cerrado' },
  { value: 'ubicacion_incorrecta', label: 'Ubicación incorrecta' },
  { value: 'fotos_incorrectas', label: 'Fotos incorrectas' },
  { value: 'otro', label: 'Otro' },
];

export default function ReportBarScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();

  const [bar, setBar] = useState<BarSummary | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!barId) return;
    (async () => {
      const { data } = await supabase
        .from('bars')
        .select('id, name, address, city')
        .eq('id', barId)
        .single();
      if (data) setBar(data as BarSummary);
    })();
  }, [barId]);

  const handleSubmit = async () => {
    if (!reason) {
      toast.warning('Selecciona un motivo');
      return;
    }
    if (!barId) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Debes iniciar sesión');
        return;
      }

      const { error } = await supabase.from('bar_reports').insert({
        bar_id: barId,
        reporter_id: user.id,
        reason,
        message: message.trim() || null,
      });

      if (error) {
        toast.supabaseError(error, 'No se pudo enviar el reporte');
        return;
      }

      toast.success('Gracias, revisaremos la información');
      router.back();
    } catch (error) {
      console.error('❌ Error reporting bar:', error);
      toast.error('No se pudo enviar el reporte', 'Inténtalo de nuevo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={28} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="h2">Reportar información</AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {bar && (
          <View style={styles.barInfo}>
            <AppText variant="title" numberOfLines={1}>{bar.name}</AppText>
            <AppText variant="caption" color={colors.text.secondary} numberOfLines={1}>
              {(bar.address || 'Sin dirección') + (bar.city ? `, ${bar.city}` : '')}
            </AppText>
          </View>
        )}

        <View style={styles.section}>
          <AppText variant="subtitle" style={styles.sectionTitle}>¿Qué está mal?</AppText>
          <View style={styles.chipsRow}>
            {REASON_OPTIONS.map((option) => (
              <AppChip
                key={option.value}
                label={option.label}
                selected={reason === option.value}
                onPress={() => setReason(option.value)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="subtitle" style={styles.sectionTitle}>Cuéntanos más (opcional)</AppText>
          <View style={styles.textInputWrapper}>
            <TextInput
              placeholder="Describe qué información está mal..."
              placeholderTextColor={colors.text.muted}
              value={message}
              onChangeText={setMessage}
              multiline
              style={styles.textInput}
              textAlignVertical="top"
              maxLength={500}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <AppButton
          text={loading ? 'Enviando...' : 'Enviar reporte'}
          onPress={handleSubmit}
          variant="primary"
          loading={loading}
          disabled={!reason || loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerSpacer: {
    width: 28,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  barInfo: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xxs,
  },
  section: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  textInputWrapper: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  textInput: {
    minHeight: 100,
    padding: spacing.lg,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bg.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});
