import { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { supabase } from '~/utils/supabase';
import { haversineDistanceMeters } from '~/utils/geo';
import { AppText, AppButton, toast, colors, spacing, radius, shadows } from '~/components/ds';

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ClaimState = 'idle' | 'ticket_selected' | 'loading' | 'success' | 'error';

interface ClaimResult {
  claim_count: number;
  rarity: 'common' | 'rare' | 'legendary';
  auto_approved: boolean;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ClaimScarfScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    barId: string;
    matchId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeTeamName: string;
    awayTeamName: string;
    homeLogoUrl: string;
    awayLogoUrl: string;
    matchDate: string;
    matchTime: string;
    barLat: string;
    barLng: string;
    competitionName: string;
  }>();

  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [ticketUri, setTicketUri] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState('');
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [locationVerified, setLocationVerified] = useState<boolean | null>(null);
  const [matchDayVerified, setMatchDayVerified] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [peopleCount, setPeopleCount] = useState(1);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // ─── Verificar fecha del partido ──────────────────────────────────────────

  const verifyMatchDay = useCallback((): boolean => {
    if (!params.matchDate) return false;
    const matchDate = new Date(params.matchDate);
    const today = new Date();
    return matchDate.toDateString() === today.toDateString();
  }, [params.matchDate]);

  // ─── Verificar ubicación ──────────────────────────────────────────────────

  const verifyLocation = useCallback(async (): Promise<{ verified: boolean; lat: number | null; lng: number | null }> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return { verified: false, lat: null, lng: null };
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const barLat = parseFloat(params.barLat ?? '0');
      const barLng = parseFloat(params.barLng ?? '0');

      if (!barLat || !barLng) {
        return { verified: false, lat: loc.coords.latitude, lng: loc.coords.longitude };
      }

      const distMeters = haversineDistanceMeters(
        loc.coords.latitude,
        loc.coords.longitude,
        barLat,
        barLng
      );

      return {
        verified: distMeters <= 500,
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
    } catch {
      return { verified: false, lat: null, lng: null };
    }
  }, [params.barLat, params.barLng]);

  // ─── Verificar hora del partido (±3h) ────────────────────────────────────

  const verifyMatchTime = useCallback((): boolean => {
    if (!params.matchDate || !params.matchTime) return false;
    try {
      const matchDateTime = new Date(`${params.matchDate}T${params.matchTime}`);
      const diffHours = Math.abs(Date.now() - matchDateTime.getTime()) / 3_600_000;
      return diffHours <= 3;
    } catch {
      return false;
    }
  }, [params.matchDate, params.matchTime]);

  // ─── Subir imagen a Storage ───────────────────────────────────────────────

  const uploadTicketImage = useCallback(async (uri: string): Promise<string> => {
    if (!userId) throw new Error('Usuario no autenticado');

    const filePath = `${userId}/${params.matchId}_${Date.now()}.jpg`;

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists || fileInfo.size === 0) {
      throw new Error('El archivo del ticket no es válido');
    }

    // Método 1: base64 (más fiable en iOS)
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64);
      const arrayBuffer = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        arrayBuffer[i] = binaryString.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from('ticket-claims')
        .upload(filePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

      if (error) throw error;
    } catch {
      // Método 2: blob fallback
      const response = await fetch(uri);
      const blob = await response.blob();
      const { error } = await supabase.storage
        .from('ticket-claims')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
    }

    const { data: urlData } = supabase.storage
      .from('ticket-claims')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) throw new Error('No se pudo obtener la URL del ticket');
    return urlData.publicUrl;
  }, [userId, params.matchId]);

  // ─── Seleccionar foto del ticket ──────────────────────────────────────────

  const handlePickTicket = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tu galería para subir la foto del ticket.',
        [{ text: 'Entendido' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.75,
    });

    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    if (!file.uri) return;

    setTicketUri(file.uri);
    setClaimState('ticket_selected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handlePickTicketFromCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara.', [{ text: 'Entendido' }]);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.75,
    });

    if (result.canceled || !result.assets?.length) return;
    const file = result.assets[0];
    if (!file.uri) return;

    setTicketUri(file.uri);
    setClaimState('ticket_selected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectTicket = useCallback(() => {
    Alert.alert('Foto del ticket', 'Elige cómo subir la foto', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Galería', onPress: handlePickTicket },
      { text: 'Cámara', onPress: handlePickTicketFromCamera },
    ]);
  }, [handlePickTicket, handlePickTicketFromCamera]);

  // ─── Reclamar bufandas ────────────────────────────────────────────────────

  const handleClaim = useCallback(async () => {
    if (!ticketUri || !userId) return;

    setClaimState('loading');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let ticketUrl = '';
    let locVerified = false;
    let locLat: number | null = null;
    let locLng: number | null = null;
    let matchDayOk = false;
    let matchTimeOk = false;

    try {
      // Verificar fecha del partido
      matchDayOk = verifyMatchDay();
      matchTimeOk = verifyMatchTime();
      setMatchDayVerified(matchDayOk);

      // Verificar ubicación y subir imagen en paralelo
      setLoadingStep('Verificando ubicación...');
      const [locationResult, uploadedUrl] = await Promise.all([
        verifyLocation(),
        (async () => {
          setLoadingStep('Subiendo ticket...');
          return uploadTicketImage(ticketUri);
        })(),
      ]);

      locVerified = locationResult.verified;
      locLat = locationResult.lat;
      locLng = locationResult.lng;
      ticketUrl = uploadedUrl;
      setLocationVerified(locVerified);

      // Registrar ambas bufandas (home + away)
      setLoadingStep('Registrando bufandas...');

      const claimParams = {
        _bar_id: params.barId,
        _match_id: params.matchId || null,
        _ticket_image_url: ticketUrl,
        _location_verified: locVerified,
        _location_lat: locLat,
        _location_lng: locLng,
        _match_day_verified: matchDayOk,
        _match_time_verified: matchTimeOk,
        _people_count: peopleCount,
      };

      // Fallback: si la migración aún no está aplicada (PGRST202), reintenta sin _people_count
      const rpcWithFallback = async (teamId: string) => {
        const fullParams = { ...claimParams, _team_id: teamId };
        const result = await supabase.rpc('fn_claim_scarf', fullParams);
        if ((result.error as any)?.code === 'PGRST202') {
          const { _people_count: _, ...legacyParams } = fullParams;
          return supabase.rpc('fn_claim_scarf', legacyParams);
        }
        return result;
      };

      const [homeResult, awayResult] = await Promise.all([
        rpcWithFallback(params.homeTeamId),
        rpcWithFallback(params.awayTeamId),
      ]);

      if (homeResult.error) throw homeResult.error;
      if (awayResult.error) throw awayResult.error;

      const homeData = homeResult.data as ClaimResult;
      // Usamos el resultado del equipo con mayor claim_count para el summary
      const awayData = awayResult.data as ClaimResult;
      const best = (homeData?.claim_count ?? 0) >= (awayData?.claim_count ?? 0) ? homeData : awayData;

      setClaimResult(best);
      setClaimState('success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('❌ Error claiming scarf:', error);
      setClaimState('error');
      toast.error('No se pudieron registrar las bufandas', 'Inténtalo de nuevo');
    }
  }, [
    ticketUri, userId, params,
    verifyMatchDay, verifyMatchTime, verifyLocation, uploadTicketImage,
  ]);

  // ─── UI helpers ───────────────────────────────────────────────────────────

  const homeLogoUrl =
    params.homeLogoUrl ||
    `${SUPABASE_URL}/storage/v1/object/public/logo_teams/${params.homeTeamId}.png`;
  const awayLogoUrl =
    params.awayLogoUrl ||
    `${SUPABASE_URL}/storage/v1/object/public/logo_teams/${params.awayTeamId}.png`;

  const matchDateFormatted = params.matchDate
    ? new Date(params.matchDate).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  const matchTimeFormatted = params.matchTime
    ? params.matchTime.substring(0, 5)
    : '';

  // ─── Render: SUCCESS ──────────────────────────────────────────────────────

  if (claimState === 'success') {
    const rarityColor =
      claimResult?.rarity === 'legendary'
        ? colors.status.success
        : claimResult?.rarity === 'rare'
          ? colors.status.boost
          : colors.text.muted;
    const rarityLabel =
      claimResult?.rarity === 'legendary'
        ? 'Legendaria 🏆'
        : claimResult?.rarity === 'rare'
          ? 'Rara ⭐'
          : 'Común';

    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.successContent}>

          {/* Emoji + títulos */}
          <AppText style={styles.successEmoji}>🎉</AppText>
          <AppText variant="h2" align="center" style={styles.successTitle}>
            ¡Bufandas conseguidas!
          </AppText>
          <AppText variant="body" color={colors.text.secondary} align="center" style={styles.successSubtitle}>
            Has añadido 2 bufandas a tu colección
          </AppText>

          {/* Escudos */}
          <View style={styles.successTeams}>
            <View style={styles.successTeamItem}>
              <View style={styles.successLogoWrapper}>
                <Image
                  source={{ uri: homeLogoUrl }}
                  style={styles.successLogo}
                  resizeMode="contain"
                  defaultSource={require('~/assets/icon.png')}
                />
              </View>
              <AppText variant="caption" align="center" maxScale={1.0} numberOfLines={2} style={styles.successTeamName}>
                {params.homeTeamName}
              </AppText>
            </View>

            <AppText variant="title" color={colors.text.muted} style={styles.successPlus}>+</AppText>

            <View style={styles.successTeamItem}>
              <View style={styles.successLogoWrapper}>
                <Image
                  source={{ uri: awayLogoUrl }}
                  style={styles.successLogo}
                  resizeMode="contain"
                  defaultSource={require('~/assets/icon.png')}
                />
              </View>
              <AppText variant="caption" align="center" maxScale={1.0} numberOfLines={2} style={styles.successTeamName}>
                {params.awayTeamName}
              </AppText>
            </View>
          </View>

          {/* Rareza */}
          <View style={[styles.rarityPill, { borderColor: rarityColor, backgroundColor: `${rarityColor}18` }]}>
            <AppText variant="label" color={rarityColor} maxScale={1.0}>{rarityLabel}</AppText>
            {claimResult && claimResult.claim_count > 1 && (
              <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                · {claimResult.claim_count} visitas
              </AppText>
            )}
          </View>

          {/* Validaciones como chips en fila */}
          <View style={styles.validationRow}>
            {locationVerified !== null && (
              <View style={[styles.validationChip, locationVerified ? styles.chipGreen : styles.chipOrange]}>
                <Ionicons
                  name={locationVerified ? 'location' : 'location-outline'}
                  size={13}
                  color={locationVerified ? colors.status.success : colors.status.warning}
                />
                <AppText
                  variant="caption"
                  color={locationVerified ? colors.status.success : colors.status.warning}
                  maxScale={1.0}
                >
                  Ubicación
                </AppText>
              </View>
            )}
            {matchDayVerified !== null && (
              <View style={[styles.validationChip, matchDayVerified ? styles.chipGreen : styles.chipOrange]}>
                <Ionicons
                  name={matchDayVerified ? 'football' : 'football-outline'}
                  size={13}
                  color={matchDayVerified ? colors.status.success : colors.status.warning}
                />
                <AppText
                  variant="caption"
                  color={matchDayVerified ? colors.status.success : colors.status.warning}
                  maxScale={1.0}
                >
                  Partido
                </AppText>
              </View>
            )}
            <View style={[styles.validationChip, styles.chipGray]}>
              <Ionicons name="camera-outline" size={13} color={colors.text.muted} />
              <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                Ticket
              </AppText>
            </View>
          </View>

          {/* CTA */}
          <View style={styles.successCta}>
            <AppButton
              text="Ver mi colección"
              onPress={() => router.replace('/scarves' as any)}
              variant="primary"
              fullWidth
            />
            <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
              <AppText variant="caption" color={colors.text.secondary}>
                Volver al bar
              </AppText>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: LOADING ─────────────────────────────────────────────────────

  if (claimState === 'loading') {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={colors.status.boost} />
          <AppText variant="body" color={colors.text.secondary} style={{ marginTop: spacing.lg }}>
            {loadingStep}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: IDLE / TICKET_SELECTED ───────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <AppText variant="title">Reclamar bufandas</AppText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Partido */}
        <View style={styles.matchCard}>
          {/* Competición */}
          <View style={styles.competitionRow}>
            <Ionicons name="trophy-outline" size={14} color={colors.status.boost} />
            <AppText variant="caption" color={colors.status.boost} maxScale={1.0}>
              {params.competitionName || 'LaLiga'}
            </AppText>
          </View>

          {/* Equipos */}
          <View style={styles.teamsRow}>
            <View style={styles.teamColumn}>
              <Image
                source={{ uri: homeLogoUrl }}
                style={styles.teamLogo}
                resizeMode="contain"
                defaultSource={require('~/assets/icon.png')}
              />
              <AppText variant="label" align="center" numberOfLines={2} maxScale={1.1}>
                {params.homeTeamName}
              </AppText>
            </View>

            <View style={styles.vsContainer}>
              <AppText variant="subtitle" color={colors.text.muted}>vs</AppText>
              <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                {matchDateFormatted}
              </AppText>
              {matchTimeFormatted ? (
                <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                  {matchTimeFormatted}
                </AppText>
              ) : null}
            </View>

            <View style={styles.teamColumn}>
              <Image
                source={{ uri: awayLogoUrl }}
                style={styles.teamLogo}
                resizeMode="contain"
                defaultSource={require('~/assets/icon.png')}
              />
              <AppText variant="label" align="center" numberOfLines={2} maxScale={1.1}>
                {params.awayTeamName}
              </AppText>
            </View>
          </View>
        </View>

        {/* Preview bufandas a recibir */}
        <View style={styles.scarfPreviewCard}>
          <AppText variant="label" color={colors.text.secondary} maxScale={1.0} style={styles.previewLabel}>
            🧣 Recibirás estas bufandas:
          </AppText>
          <View style={styles.previewTeams}>
            <View style={styles.previewTeam}>
              <Image
                source={{ uri: homeLogoUrl }}
                style={styles.previewLogo}
                resizeMode="contain"
                defaultSource={require('~/assets/icon.png')}
              />
              <AppText variant="caption" align="center" maxScale={1.0} numberOfLines={1}>
                {params.homeTeamName}
              </AppText>
            </View>
            <View style={styles.previewTeam}>
              <Image
                source={{ uri: awayLogoUrl }}
                style={styles.previewLogo}
                resizeMode="contain"
                defaultSource={require('~/assets/icon.png')}
              />
              <AppText variant="caption" align="center" maxScale={1.0} numberOfLines={1}>
                {params.awayTeamName}
              </AppText>
            </View>
          </View>
        </View>

        {/* Sección ticket */}
        <View style={styles.ticketSection}>
          <AppText variant="subtitle" style={styles.ticketTitle}>
            📸 Foto del ticket
          </AppText>
          <AppText variant="body" color={colors.text.secondary} style={styles.ticketSubtitle}>
            Sube una foto de tu entrada o ticket para reclamar las bufandas
          </AppText>

          {ticketUri ? (
            <View>
              <Image source={{ uri: ticketUri }} style={styles.ticketPreview} resizeMode="cover" />
              {/* Cambiar foto - estilo acción */}
              <TouchableOpacity style={styles.actionRow} onPress={handleSelectTicket} activeOpacity={0.7}>
                <View style={styles.actionIcon}>
                  <Ionicons name="refresh-outline" size={18} color={colors.text.secondary} />
                </View>
                <AppText variant="body" color={colors.text.primary} style={styles.actionText}>
                  Cambiar foto
                </AppText>
                <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          ) : (
            /* Subir foto - estilo acción */
            <TouchableOpacity style={styles.actionRow} onPress={handleSelectTicket} activeOpacity={0.7}>
              <View style={styles.actionIcon}>
                <Ionicons name="camera-outline" size={18} color={colors.text.secondary} />
              </View>
              <View style={styles.actionContent}>
                <AppText variant="body" color={colors.text.primary} style={styles.actionText}>
                  Subir foto del ticket
                </AppText>
                <AppText variant="caption" color={colors.text.muted} maxScale={1.0}>
                  Galería o cámara
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Número de personas */}
        <View style={styles.peopleSection}>
          <AppText variant="subtitle" style={styles.ticketTitle}>
            👥 ¿Cuántas personas sois?
          </AppText>
          <AppText variant="body" color={colors.text.secondary} style={styles.ticketSubtitle}>
            Incluye a todos los que estáis viendo el partido
          </AppText>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepperBtn, peopleCount <= 1 && styles.stepperBtnDisabled]}
              onPress={() => {
                if (peopleCount > 1) {
                  setPeopleCount(c => c - 1);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="remove" size={20} color={peopleCount <= 1 ? colors.text.muted : colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.stepperCount}>
              <AppText variant="h2" align="center" maxScale={1.0}>{peopleCount}</AppText>
              <AppText variant="caption" color={colors.text.muted} align="center" maxScale={1.0}>
                {peopleCount === 1 ? 'persona' : 'personas'}
              </AppText>
            </View>
            <TouchableOpacity
              style={[styles.stepperBtn, peopleCount >= 20 && styles.stepperBtnDisabled]}
              onPress={() => {
                if (peopleCount < 20) {
                  setPeopleCount(c => c + 1);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={peopleCount >= 20 ? colors.text.muted : colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info de verificación */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
          <AppText variant="caption" color={colors.text.muted} style={styles.infoText} maxScale={1.2}>
            Verificaremos tu ubicación y la fecha del partido automáticamente. El ticket queda en revisión manual.
          </AppText>
        </View>

        {/* CTA */}
        <View style={styles.ctaButton}>
          {claimState === 'ticket_selected' ? (
            <AppButton
              text="Confirmar y reclamar"
              onPress={handleClaim}
              variant="primary"
              fullWidth
            />
          ) : (
            <AppButton
              text="Subir ticket"
              onPress={handleSelectTicket}
              variant="primary"
              fullWidth
            />
          )}
        </View>

        {claimState === 'error' && (
          <View style={{ marginTop: spacing.md }}>
            <AppButton
              text="Reintentar"
              onPress={handleClaim}
              variant="outline"
              fullWidth
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

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
  backButton: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
  },
  // Partido
  matchCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  competitionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    justifyContent: 'center',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  teamLogo: {
    width: 64,
    height: 64,
  },
  vsContainer: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  // Preview bufandas
  scarfPreviewCard: {
    backgroundColor: 'rgba(255,215,0,0.06)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  previewLabel: {
    marginBottom: spacing.md,
  },
  previewTeams: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  previewTeam: {
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  previewLogo: {
    width: 44,
    height: 44,
  },
  // Sección ticket
  ticketSection: {
    marginBottom: spacing.lg,
  },
  ticketTitle: {
    marginBottom: spacing.sm,
  },
  ticketSubtitle: {
    marginBottom: spacing.lg,
  },
  ticketPreview: {
    width: '100%',
    height: 200,
    borderRadius: radius.xl,
    backgroundColor: colors.bg.element,
    marginBottom: spacing.sm,
  },
  // Botones estilo "acción de bar" (sin colorines)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionText: {
    fontWeight: '600',
    fontSize: 13,
  },
  // Contador de personas
  peopleSection: {
    marginBottom: spacing.lg,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperCount: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: spacing.sm,
  },
  // Info box
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bg.element,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
  },
  // CTA
  ctaButton: {
    marginBottom: spacing.md,
  },
  // Loading
  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  // Success
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: spacing.lg,
  },
  successTitle: {
    marginBottom: spacing.xs,
  },
  successSubtitle: {
    marginBottom: spacing.xxl,
  },
  successTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    width: '100%',
  },
  successTeamItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  successLogoWrapper: {
    width: 80,
    height: 80,
    borderRadius: radius.round,
    backgroundColor: colors.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  successLogo: {
    width: 60,
    height: 60,
  },
  successTeamName: {
    maxWidth: 100,
  },
  successPlus: {
    paddingHorizontal: spacing.md,
  },
  rarityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  // Validaciones compactas en fila
  validationRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  validationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  chipGreen: {
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  chipOrange: {
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  chipGray: {
    backgroundColor: colors.bg.element,
  },
  successCta: {
    width: '100%',
    gap: spacing.xs,
    alignItems: 'center',
  },
  backLink: {
    paddingVertical: spacing.md,
  },
});
