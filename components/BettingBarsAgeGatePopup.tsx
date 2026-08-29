import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText, colors, spacing, radius } from '~/components/ds';
import { setBettingBarsPreference } from '~/services/users';
import { useBettingBarsVisibilityStore } from '~/stores/bettingBarsVisibilityStore';

const C = {
  bg: '#0e1219',
};

interface BettingBarsAgeGatePopupProps {
  visible: boolean;
  userId: string;
  mode: 'onboarding' | 'settings';
  onClose: () => void;
  onSaved?: (result: { isAdultConfirmed: boolean; showBettingBars: boolean }) => void;
}

type Step = 'age' | 'preference';

export default function BettingBarsAgeGatePopup({
  visible,
  userId,
  onClose,
  onSaved,
}: BettingBarsAgeGatePopupProps) {
  const [step, setStep] = useState<Step>('age');
  const [saving, setSaving] = useState(false);
  const setFromServer = useBettingBarsVisibilityStore((state) => state.setFromServer);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep('age');
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const save = async (isAdultConfirmed: boolean, showBettingBars: boolean) => {
    setSaving(true);
    try {
      await setBettingBarsPreference(userId, { isAdultConfirmed, showBettingBars });
      setFromServer({
        is_adult_confirmed: isAdultConfirmed,
        show_betting_bars: showBettingBars,
        betting_bars_prompted_at: new Date().toISOString(),
      });
      onSaved?.({ isAdultConfirmed, showBettingBars });
      onClose();
    } catch (error) {
      console.error('Error guardando preferencia de bares de apuestas:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUnderage = () => save(false, false);
  const handleAdult = () => setStep('preference');
  const handleWantsToSee = () => save(true, true);
  const handleDoesNotWantToSee = () => save(true, false);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
        pointerEvents="auto"
      >
        <LinearGradient
          colors={['rgba(25,118,210,0.18)', C.bg, C.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            {step === 'age' ? (
              <>
                <AppText variant="h2" maxScale={1.2}>¿Eres mayor de 18 años?</AppText>
                <AppText variant="body" color={colors.text.secondary} style={styles.subtitle}>
                  Algunos locales del mapa son establecimientos de apuestas deportivas. Solo se
                  muestran a usuarios mayores de edad que elijan verlos.
                </AppText>
              </>
            ) : (
              <>
                <AppText variant="h2" maxScale={1.2}>¿Quieres verlos en el mapa?</AppText>
                <AppText variant="body" color={colors.text.secondary} style={styles.subtitle}>
                  Puedes cambiar esta preferencia cuando quieras desde tu perfil.
                </AppText>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={saving}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {saving ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.brand.primary} />
          </View>
        ) : step === 'age' ? (
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={handleAdult}>
              <AppText variant="body" color={colors.text.primary}>Sí, soy mayor de 18 años</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={handleUnderage}>
              <AppText variant="body" color={colors.text.primary}>No</AppText>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.optionButton} onPress={handleWantsToSee}>
              <AppText variant="body" color={colors.text.primary}>Sí, quiero verlos</AppText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionButton} onPress={handleDoesNotWantToSee}>
              <AppText variant="body" color={colors.text.primary}>No, prefiero no verlos</AppText>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
  },
  container: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: C.bg,
    borderRadius: 20,
    overflow: 'hidden',
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.65,
    shadowRadius: 30,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.alpha.brandBorder,
    backgroundColor: colors.alpha.brandLight,
    alignItems: 'center',
  },
});
