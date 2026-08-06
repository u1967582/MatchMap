import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppText, AppInput, colors, spacing, radius, toast } from '~/components/ds';
import { useFavoriteTeamOptions, type FavoriteTeamOption } from '~/hooks/useFavoriteTeamOptions';
import { setFavoriteTeam, updateFavoriteTeam } from '~/services/users';
import { requestMatchNotificationsPermission } from '~/services/notifications';

const C = {
  bg: '#0e1219',
  accent: colors.brand.primary,
  closeBtnBg: 'rgba(255,255,255,0.05)',
  closeBtnBorder: 'rgba(255,255,255,0.07)',
};

interface FavoriteTeamPopupProps {
  visible: boolean;
  userId: string;
  mode: 'onboarding' | 'change';
  currentTeamId?: string | null;
  onClose: () => void;
  onSaved?: (option: FavoriteTeamOption | null) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.9;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function getTeamLogoUri(team: { id: string; logo_url: string | null }): string {
  return (
    team.logo_url ||
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${team.id}.png`
  );
}

// Ligas españolas soportadas, en el orden en que deben mostrarse los chips.
const LEAGUE_META: Record<string, { label: string; logoFilename: string }> = {
  'Primera División': { label: 'Primera', logoFilename: 'primera-division-ea.png' },
  'Segunda División': { label: 'Segunda', logoFilename: 'segunda-division-hypermotion.png' },
  'Primera División Femenina': { label: 'Femenina', logoFilename: 'ligaf.png' },
};

function getLeagueLogoUri(competitionName: string): string | null {
  const filename = LEAGUE_META[competitionName]?.logoFilename;
  if (!filename) return null;
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo-teams/${filename}`;
}

export default function FavoriteTeamPopup({
  visible,
  userId,
  mode,
  currentTeamId,
  onClose,
  onSaved,
}: FavoriteTeamPopupProps) {
  const { options, isLoading } = useFavoriteTeamOptions(visible);
  const [query, setQuery] = useState('');
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const leagues = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const team of options) {
      if (seen.has(team.competition_id)) continue;
      seen.add(team.competition_id);
      result.push({ id: team.competition_id, name: team.competition_name });
    }
    return result;
  }, [options]);

  // Selecciona Primera División por defecto en cuanto llegan las ligas disponibles.
  useEffect(() => {
    if (selectedLeagueId || leagues.length === 0) return;
    const primera = leagues.find((league) => league.name === 'Primera División');
    setSelectedLeagueId(primera?.id ?? leagues[0].id);
  }, [leagues, selectedLeagueId]);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedLeagueId(null);
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

  const filteredOptions = useMemo(() => {
    // Con búsqueda activa se ignora el filtro de liga: el usuario espera
    // encontrar el equipo por nombre sin importar en qué chip esté.
    if (query.trim()) {
      const q = normalize(query);
      return options.filter((team) => normalize(team.name).includes(q));
    }
    if (!selectedLeagueId) return options;
    return options.filter((team) => team.competition_id === selectedLeagueId);
  }, [options, query, selectedLeagueId]);

  if (!visible) return null;

  const handleSelect = async (team: FavoriteTeamOption) => {
    setSavingId(team.id);
    try {
      if (mode === 'onboarding') {
        await setFavoriteTeam(userId, team.id);
      } else {
        await updateFavoriteTeam(userId, team.id);
        toast.success('Equipo actualizado');
      }
      onSaved?.(team);
      onClose();

      // No bloqueante: si el SO va a mostrar el diálogo de permiso de
      // notificaciones, aparece justo tras cerrarse el popup. No afecta
      // al guardado del equipo elegido.
      requestMatchNotificationsPermission(userId).catch((err) =>
        console.warn('No se pudo solicitar permiso de notificaciones:', err)
      );
    } catch (error) {
      console.error('Error guardando equipo favorito:', error);
      if (mode === 'change') {
        toast.supabaseError(error, 'No se pudo actualizar tu equipo');
      }
    } finally {
      setSavingId(null);
    }
  };

  const handleSkip = async () => {
    if (mode !== 'onboarding') {
      onClose();
      return;
    }
    try {
      await setFavoriteTeam(userId, null);
    } catch (error) {
      console.error('Error marcando popup de equipo favorito como visto:', error);
    } finally {
      onClose();
    }
  };

  const renderTeam = ({ item }: { item: FavoriteTeamOption }) => {
    const isSelected = currentTeamId === item.id;
    const isSaving = savingId === item.id;

    return (
      <TouchableOpacity
        style={[styles.teamRow, isSelected && styles.teamRowSelected]}
        onPress={() => handleSelect(item)}
        disabled={savingId !== null}
        activeOpacity={0.7}
      >
        <Image source={{ uri: getTeamLogoUri(item) }} style={styles.teamLogo} />
        <AppText variant="body" style={styles.teamName} numberOfLines={1}>
          {item.name}
        </AppText>
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.brand.primary} />
        ) : isSelected ? (
          <Ionicons name="checkmark-circle" size={22} color={colors.brand.accent} />
        ) : null}
      </TouchableOpacity>
    );
  };

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
            <AppText variant="h2" maxScale={1.2}>¿Cuál es tu equipo?</AppText>
            <AppText variant="body" color={colors.text.secondary} style={styles.subtitle}>
              Elige tu club favorito. Podrás cambiarlo cuando quieras desde tu perfil.
            </AppText>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <AppInput
            placeholder="Buscar equipo..."
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        {leagues.length > 0 && !query.trim() && (
          <View style={styles.leaguesContainer}>
            <FlatList
              data={leagues}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = selectedLeagueId === item.id;
                const label = LEAGUE_META[item.name]?.label ?? item.name;
                const logoUri = getLeagueLogoUri(item.name);

                return (
                  <TouchableOpacity
                    onPress={() => setSelectedLeagueId(item.id)}
                    style={[styles.leagueChip, selected && styles.leagueChipSelected]}
                  >
                    {logoUri && (
                      <Image source={{ uri: logoUri }} style={styles.leagueChipLogo} />
                    )}
                    <AppText
                      variant="label"
                      style={[styles.leagueChipText, selected && styles.leagueChipTextSelected]}
                    >
                      {label}
                    </AppText>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        <View style={styles.listContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.brand.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredOptions}
              renderItem={renderTeam}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        {mode === 'onboarding' && (
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={savingId !== null}>
            <AppText variant="label" color={colors.text.muted}>Ahora no</AppText>
          </TouchableOpacity>
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
    width: CARD_WIDTH,
    maxHeight: '80%',
    backgroundColor: C.bg,
    borderRadius: 20,
    overflow: 'hidden',
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 16,
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
    marginBottom: spacing.md,
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
    backgroundColor: C.closeBtnBg,
    borderWidth: 1,
    borderColor: C.closeBtnBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    marginBottom: 0,
  },
  leaguesContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  leagueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 6,
  },
  leagueChipSelected: {
    backgroundColor: C.accent,
  },
  leagueChipLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    resizeMode: 'contain',
  },
  leagueChipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  leagueChipTextSelected: {
    color: '#FFFFFF',
  },
  listContainer: {
    minHeight: 240,
    maxHeight: 360,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing.xs,
  },
  teamRowSelected: {
    backgroundColor: colors.alpha.brandLight,
    borderColor: colors.alpha.brandBorder,
  },
  teamLogo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  teamName: {
    flex: 1,
  },
  skipButton: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
});
