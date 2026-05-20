import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import Reanimated, {
  useSharedValue,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import BottomTabBar from '~/components/ui/BottomTabBar';
import { useCountdown } from '~/hooks/useCountdown';
import type { CountdownTime } from '~/hooks/useCountdown';
import { useWorldCupData } from '~/hooks/useWorldCupData';
import type { WorldCupMatch, WorldCupTeam } from '~/hooks/useWorldCupData';
import {
  AppText,
  SkeletonBox,
  EmptyState,
  colors,
  spacing,
  radius,
  springs,
} from '~/components/ds';

// ── Constantes ───────────────────────────────────────────────
const WC_GOLD = '#FFD700';
const WC_GOLD_DIM = 'rgba(255,215,0,0.12)';
const WC_GOLD_BORDER = 'rgba(255,215,0,0.22)';
const MUNDIAL_START = '2026-06-11T00:00:00Z';
const MUNDIAL_LOGO = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo-teams/mundial-2026.png`;

const KNOCKOUT_ORDER = [
  'Round of 32',
  'Round of 16',
  'Quarter-finals',
  'Semi-finals',
  '3rd Place Final',
  'Final',
];

// Estructura de respaldo cuando group_name no está poblado en la BD
const GROUP_TEAMS: Record<string, string[]> = {
  'Grupo A': ['Corea del Sur', 'México', 'República Checa', 'Sudáfrica'],
  'Grupo B': ['Bosnia y Herzegovina', 'Canadá', 'Catar', 'Suiza'],
  'Grupo C': ['Brasil', 'Escocia', 'Haití', 'Marruecos'],
  'Grupo D': ['Australia', 'Estados Unidos', 'Paraguay', 'Turquía'],
  'Grupo E': ['Alemania', 'Costa de Marfil', 'Curazao', 'Ecuador'],
  'Grupo F': ['Japón', 'Países Bajos', 'Suecia', 'Túnez'],
  'Grupo G': ['Bélgica', 'Egipto', 'Irán', 'Nueva Zelanda'],
  'Grupo H': ['Arabia Saudí', 'Cabo Verde', 'España', 'Uruguay'],
  'Grupo I': ['Francia', 'Iraq', 'Noruega', 'Senegal'],
  'Grupo J': ['Argelia', 'Argentina', 'Austria', 'Jordania'],
  'Grupo K': ['Colombia', 'Portugal', 'RD Congo', 'Uzbekistán'],
  'Grupo L': ['Croacia', 'Ghana', 'Inglaterra', 'Panamá'],
};

type TabKey = 'matches' | 'groups' | 'bracket';

interface GroupStanding {
  team: WorldCupTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

// ── Helpers ──────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const formatted = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildAllGroupStandings(
  allMatches: WorldCupMatch[]
): Array<{ groupName: string; standings: GroupStanding[] }> {
  // Mapa nombre normalizado → logo_url para enriquecer el fallback
  const logoByName = new Map<string, string | null>();
  for (const m of allMatches) {
    logoByName.set(m.home_team.name.toLowerCase().trim(), m.home_team.logo_url);
    logoByName.set(m.away_team.name.toLowerCase().trim(), m.away_team.logo_url);
  }

  // Intentar construir desde group_name real de la BD
  const groupsMap = new Map<string, Map<string, GroupStanding>>();
  for (const match of allMatches) {
    const gName = match.group_name;
    if (!gName) continue;

    if (!groupsMap.has(gName)) groupsMap.set(gName, new Map());
    const group = groupsMap.get(gName)!;

    for (const team of [match.home_team, match.away_team] as WorldCupTeam[]) {
      if (!group.has(team.id)) {
        group.set(team.id, { team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
      }
    }

    if (match.status !== 'finished' || match.home_score === null || match.away_score === null) continue;

    const home = group.get(match.home_team.id)!;
    const away = group.get(match.away_team.id)!;

    home.played++; away.played++;
    home.gf += match.home_score; home.ga += match.away_score;
    away.gf += match.away_score; away.ga += match.home_score;
    home.gd = home.gf - home.ga;
    away.gd = away.gf - away.ga;

    if (match.home_score > match.away_score) {
      home.won++; home.points += 3; away.lost++;
    } else if (match.home_score < match.away_score) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; home.points++;
      away.drawn++; away.points++;
    }
  }

  if (groupsMap.size > 0) {
    return Array.from(groupsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, teamsMap]) => ({
        groupName,
        standings: Array.from(teamsMap.values()).sort(
          (a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf
        ),
      }));
  }

  // Fallback: estructura hardcodeada con logos obtenidos de los partidos disponibles
  return Object.entries(GROUP_TEAMS).map(([groupName, teamNames]) => ({
    groupName,
    standings: teamNames.map(name => ({
      team: {
        id: name,
        name,
        logo_url: logoByName.get(name.toLowerCase().trim()) ?? null,
      },
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
    })),
  }));
}

// ── Sub-componentes ──────────────────────────────────────────
function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.countdownBox}>
      <View style={styles.countdownValueBox}>
        <AppText style={styles.countdownValue}>{pad2(value)}</AppText>
      </View>
      <AppText style={styles.countdownLabel}>{label}</AppText>
    </View>
  );
}

function CountdownSep() {
  return <AppText style={styles.countdownSep}>:</AppText>;
}

function TeamLogo({ logoUrl, size }: { logoUrl: string | null; size: number }) {
  const [imgError, setImgError] = useState(false);

  if (!logoUrl || imgError) {
    return (
      <View style={[styles.teamLogoFallback, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name="football-outline" size={size * 0.45} color={colors.text.muted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: logoUrl }}
      style={{ width: size, height: size, resizeMode: 'contain' }}
      onError={() => setImgError(true)}
    />
  );
}

function LiveBadge() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.liveBadge, { opacity }]}>
      <AppText style={styles.liveText}>EN VIVO</AppText>
    </Animated.View>
  );
}

const MatchCard = memo(function MatchCard({ match }: { match: WorldCupMatch }) {
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const hasScore = isFinished || isLive;

  const localTime = new Date(match.datetime_utc).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchTeamsRow}>
        {/* Equipo local */}
        <View style={styles.matchTeam}>
          <TeamLogo logoUrl={match.home_team.logo_url} size={44} />
          <AppText variant="caption" align="center" style={styles.teamName} numberOfLines={2}>
            {match.home_team.name}
          </AppText>
        </View>

        {/* Centro: marcador o hora */}
        <View style={styles.matchCenter}>
          {hasScore ? (
            <View style={styles.scoreContainer}>
              <AppText style={styles.scoreText}>
                {match.home_score} - {match.away_score}
              </AppText>
              {isLive && <LiveBadge />}
            </View>
          ) : (
            <AppText style={styles.matchTime}>{localTime}</AppText>
          )}
          {match.stadium && (
            <View style={styles.stadiumRow}>
              <Ionicons name="location-outline" size={10} color={colors.text.muted} />
              <AppText style={styles.stadiumText} numberOfLines={1}>{match.stadium}</AppText>
            </View>
          )}
        </View>

        {/* Equipo visitante */}
        <View style={styles.matchTeam}>
          <TeamLogo logoUrl={match.away_team.logo_url} size={44} />
          <AppText variant="caption" align="center" style={styles.teamName} numberOfLines={2}>
            {match.away_team.name}
          </AppText>
        </View>
      </View>
    </View>
  );
});

function WorldCupHeader({ countdown }: { countdown: CountdownTime }) {
  const trophyScale = useSharedValue(0.3);

  useEffect(() => {
    trophyScale.value = withSpring(1, springs.bouncy);
  }, [trophyScale]);

  const trophyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trophyScale.value }],
  }));

  return (
    <LinearGradient
      colors={['rgba(255,215,0,0.20)', 'rgba(255,215,0,0.08)', 'transparent']}
      style={styles.headerGradient}
    >
      {/* Estrellas decorativas */}
      <View style={styles.starsRow}>
        {['★', '★', '★', '★', '★'].map((s, i) => (
          <AppText key={i} style={styles.decorStar}>{s}</AppText>
        ))}
      </View>

      <View style={styles.headerContent}>
        <Reanimated.View style={[styles.logoRing, trophyStyle]}>
          <Image
            source={{ uri: MUNDIAL_LOGO }}
            style={styles.mundialLogo}
            resizeMode="contain"
          />
        </Reanimated.View>

        <AppText style={styles.mundialTitle}>MUNDIAL 2026</AppText>
        <AppText variant="caption" color={colors.text.muted} align="center" style={styles.hostText}>
          Estados Unidos · México · Canadá
        </AppText>

        <View style={styles.countdownWrapper}>
          {countdown.expired ? (
            <View style={styles.startedRow}>
              <AppText style={styles.startedText}>¡El torneo ha comenzado! 🎉</AppText>
            </View>
          ) : (
            <View style={styles.countdownRow}>
              <CountdownBox value={countdown.days} label="DÍAS" />
              <CountdownSep />
              <CountdownBox value={countdown.hours} label="HORAS" />
              <CountdownSep />
              <CountdownBox value={countdown.minutes} label="MIN" />
              <CountdownSep />
              <CountdownBox value={countdown.seconds} label="SEG" />
            </View>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

// ── Tabs de contenido ────────────────────────────────────────
function MatchesTab({
  sortedDates,
  matchesByDate,
  loading,
  refreshing,
  onRefresh,
  onScrollY,
}: {
  sortedDates: string[];
  matchesByDate: Record<string, WorldCupMatch[]>;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onScrollY: (y: number) => void;
}) {
  if (loading) {
    return (
      <View style={styles.tabPad}>
        <SkeletonBox width="100%" height={90} style={styles.skeletonGap} />
        <SkeletonBox width="100%" height={90} style={styles.skeletonGap} />
        <SkeletonBox width="100%" height={90} style={styles.skeletonGap} />
      </View>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <EmptyState
        icon="football-outline"
        title="Sin partidos del Mundial"
        subtitle="Los partidos del Mundial 2026 aparecerán aquí cuando estén disponibles"
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.matchListContent}
      scrollEventThrottle={16}
      onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={WC_GOLD}
          colors={[WC_GOLD]}
        />
      }
    >
      {sortedDates.map(date => (
        <View key={date}>
          <View style={styles.dateSectionHeader}>
            <View style={styles.dateLine} />
            <AppText style={styles.dateSectionText}>{formatDate(date)}</AppText>
            <View style={styles.dateLine} />
          </View>
          {matchesByDate[date].map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const POS_COLORS = ['#2E7D32', '#388E3C', '#546E7A', '#C62828'] as const;
const POS_BG = ['rgba(46,125,50,0.15)', 'rgba(56,142,60,0.10)', 'transparent', 'rgba(198,40,40,0.10)'] as const;
const STAT_COLS = ['Pts', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG'] as const;

function GroupTable({ groupName, standings }: { groupName: string; standings: GroupStanding[] }) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <AppText style={styles.groupHeaderText}>{groupName}</AppText>
      </View>

      {/* Cabecera de columnas */}
      <View style={styles.standingRow}>
        <View style={styles.standingTeamCol} />
        {STAT_COLS.map(col => (
          <AppText key={col} style={[styles.standingColHeader, styles.standingStatCol]}>{col}</AppText>
        ))}
      </View>

      {standings.map((s, idx) => {
        const posColor = POS_COLORS[Math.min(idx, 3)];
        const rowBg = POS_BG[Math.min(idx, 3)];
        const stats = [s.points, s.played, s.won, s.drawn, s.lost, s.gf, s.ga, s.gd];
        return (
          <View
            key={s.team.id}
            style={[
              styles.standingRow,
              { backgroundColor: rowBg },
              idx === standings.length - 1 && styles.standingRowLast,
            ]}
          >
            <View style={styles.standingTeamCol}>
              <View style={[styles.posBadge, { backgroundColor: posColor }]}>
                <AppText style={styles.posBadgeText}>{idx + 1}</AppText>
              </View>
              <TeamLogo logoUrl={s.team.logo_url} size={20} />
              <AppText style={styles.standingTeamName} numberOfLines={1}>{s.team.name}</AppText>
            </View>
            {stats.map((val, i) => (
              <AppText
                key={i}
                style={[styles.standingStatCol, i === 0 && styles.standingPtsText]}
              >
                {i === 7 && val > 0 ? `+${val}` : val}
              </AppText>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function GroupsTab({ matches, loading, onScrollY }: { matches: WorldCupMatch[]; loading: boolean; onScrollY: (y: number) => void }) {
  const groupStandings = useMemo(() => buildAllGroupStandings(matches), [matches]);

  if (loading) {
    return (
      <View style={styles.tabPad}>
        <SkeletonBox width="100%" height={200} style={styles.skeletonGap} />
        <SkeletonBox width="100%" height={200} style={styles.skeletonGap} />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.groupsContent}
      scrollEventThrottle={16}
      onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
    >
      {groupStandings.map(({ groupName, standings }) => (
        <GroupTable key={groupName} groupName={groupName} standings={standings} />
      ))}
    </ScrollView>
  );
}

function BracketTab({
  knockoutMatches,
  loading,
  onScrollY,
}: {
  knockoutMatches: WorldCupMatch[];
  loading: boolean;
  onScrollY: (y: number) => void;
}) {
  const roundsMap = useMemo(() => {
    const map: Record<string, WorldCupMatch[]> = {};
    for (const match of knockoutMatches) {
      const round = match.round_name ?? 'Eliminatorias';
      if (!map[round]) map[round] = [];
      map[round].push(match);
    }
    return map;
  }, [knockoutMatches]);

  const sortedRounds = useMemo(() =>
    KNOCKOUT_ORDER.filter(r => roundsMap[r]).concat(
      Object.keys(roundsMap).filter(r => !KNOCKOUT_ORDER.includes(r))
    ),
    [roundsMap]
  );

  if (loading) {
    return (
      <View style={styles.tabPad}>
        <SkeletonBox width="100%" height={120} style={styles.skeletonGap} />
        <SkeletonBox width="100%" height={120} style={styles.skeletonGap} />
      </View>
    );
  }

  if (sortedRounds.length === 0) {
    return (
      <EmptyState
        icon="git-branch-outline"
        title="Cuadro por confirmar"
        subtitle="El cuadro eliminatorio se irá completando a medida que avanza el torneo"
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.bracketContent}
      scrollEventThrottle={16}
      onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
    >
      {sortedRounds.map(round => (
        <View key={round}>
          <View style={styles.bracketRoundHeader}>
            <View style={styles.bracketRoundLine} />
            <AppText style={styles.bracketRoundTitle}>{round}</AppText>
            <View style={styles.bracketRoundLine} />
          </View>
          {roundsMap[round].map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Tab Button ───────────────────────────────────────────────
function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Reanimated.View style={animStyle}>
      <Pressable
        style={[styles.tabBtn, selected && styles.tabBtnSelected]}
        onPressIn={() => { scale.value = withSpring(0.95, springs.press); }}
        onPressOut={() => { scale.value = withSpring(1, springs.press); }}
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
      >
        <AppText style={[styles.tabBtnLabel, selected && styles.tabBtnLabelSelected]}>
          {label}
        </AppText>
      </Pressable>
    </Reanimated.View>
  );
}

// ── Pantalla principal ───────────────────────────────────────
export default function WorldCupHubScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('matches');
  const [refreshing, setRefreshing] = useState(false);
  const countdown = useCountdown(MUNDIAL_START);
  const { matches, loading, refetch } = useWorldCupData();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Animación de entrada + colapso al scroll (useNativeDriver:false para maxHeight)
  const headerAnim = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isCollapsed = useRef(false);

  // Entrada al montar
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 350, useNativeDriver: false }).start();
  }, [headerAnim]);

  // Al cambiar de tab, restaurar header
  useEffect(() => {
    lastScrollY.current = 0;
    if (isCollapsed.current) {
      isCollapsed.current = false;
      Animated.timing(headerAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    }
  }, [activeTab, headerAnim]);

  const onContentScroll = useCallback((y: number) => {
    const prev = lastScrollY.current;
    lastScrollY.current = y;
    if (y < 10 && isCollapsed.current) {
      isCollapsed.current = false;
      Animated.timing(headerAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
      return;
    }
    if (y - prev > 4 && !isCollapsed.current) {
      isCollapsed.current = true;
      Animated.timing(headerAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    } else if (prev - y > 4 && isCollapsed.current) {
      isCollapsed.current = false;
      Animated.timing(headerAnim, { toValue: 1, duration: 220, useNativeDriver: false }).start();
    }
  }, [headerAnim]);

  // Derivaciones de datos según tab
  const matchesByDate = useMemo(() => {
    const groups: Record<string, WorldCupMatch[]> = {};
    for (const m of matches) {
      if (!groups[m.date]) groups[m.date] = [];
      groups[m.date].push(m);
    }
    return groups;
  }, [matches]);

  const sortedDates = useMemo(() => Object.keys(matchesByDate).sort(), [matchesByDate]);

  const knockoutMatches = useMemo(
    () => matches.filter(m => m.round_name && !m.round_name.toLowerCase().includes('group')),
    [matches]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header colapsable al hacer scroll */}
      <Animated.View
        style={{
          opacity: headerAnim,
          maxHeight: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
          overflow: 'hidden',
        }}
      >
        <WorldCupHeader countdown={countdown} />
      </Animated.View>

      {/* Selector de tabs — siempre visible */}
      <View style={styles.tabSelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabSelectorContent}
        >
          <TabButton
            label="Partidos"
            selected={activeTab === 'matches'}
            onPress={() => setActiveTab('matches')}
          />
          <TabButton
            label="Grupos"
            selected={activeTab === 'groups'}
            onPress={() => setActiveTab('groups')}
          />
          <TabButton
            label="Cuadro"
            selected={activeTab === 'bracket'}
            onPress={() => setActiveTab('bracket')}
          />
        </ScrollView>
      </View>

      {/* Contenido del tab activo */}
      <View style={styles.tabContent}>
        {activeTab === 'matches' && (
          <MatchesTab
            sortedDates={sortedDates}
            matchesByDate={matchesByDate}
            loading={loading}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            onScrollY={onContentScroll}
          />
        )}
        {activeTab === 'groups' && (
          <GroupsTab matches={matches} loading={loading} onScrollY={onContentScroll} />
        )}
        {activeTab === 'bracket' && (
          <BracketTab knockoutMatches={knockoutMatches} loading={loading} onScrollY={onContentScroll} />
        )}
      </View>

      <BottomTabBar />
    </SafeAreaView>
  );
}

// ── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Header
  headerGradient: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: WC_GOLD_BORDER,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    opacity: 0.4,
  },
  decorStar: {
    fontSize: 10,
    color: WC_GOLD,
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: WC_GOLD_BORDER,
    backgroundColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: WC_GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  mundialLogo: {
    width: 88,
    height: 88,
  },
  hostText: {
    letterSpacing: 0.3,
  },
  mundialTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: WC_GOLD,
    letterSpacing: 3,
    textAlign: 'center',
  },

  // Countdown
  countdownWrapper: {
    marginTop: spacing.sm,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countdownBox: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  countdownValueBox: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,215,0,0.35)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 58,
    alignItems: 'center',
    shadowColor: WC_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  countdownValue: {
    fontSize: 24,
    fontWeight: '800',
    color: WC_GOLD,
    fontVariant: ['tabular-nums'],
  },
  countdownLabel: {
    fontSize: 9,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  countdownSep: {
    fontSize: 22,
    fontWeight: '700',
    color: WC_GOLD,
    opacity: 0.4,
    marginBottom: spacing.lg,
  },
  startedRow: {
    paddingVertical: spacing.xs,
  },
  startedText: {
    fontSize: 16,
    fontWeight: '600',
    color: WC_GOLD,
    textAlign: 'center',
  },

  // Tab selector
  tabSelectorWrapper: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.elevated,
  },
  tabSelectorContent: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },

  // Tab button
  tabBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.round,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabBtnSelected: {
    backgroundColor: WC_GOLD_DIM,
    borderColor: WC_GOLD_BORDER,
  },
  tabBtnLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  tabBtnLabelSelected: {
    color: WC_GOLD,
    fontWeight: '700',
  },

  // Tab content
  tabContent: {
    flex: 1,
  },
  tabPad: {
    padding: spacing.xl,
  },
  skeletonGap: {
    marginBottom: spacing.md,
    borderRadius: radius.md,
  },

  // Match list
  matchListContent: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 110 : 90,
  },
  dateSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bg.elevated,
  },
  dateSectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: WC_GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Match card
  matchCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.bg.elevated,
  },
  matchTeamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchTeam: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  teamName: {
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 15,
  },
  matchCenter: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.xxs,
  },
  scoreContainer: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  matchTime: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    fontVariant: ['tabular-nums'],
  },
  stadiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xxs,
  },
  stadiumText: {
    fontSize: 10,
    color: colors.text.muted,
    maxWidth: 120,
  },

  // Team logo fallback
  teamLogoFallback: {
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Live badge
  liveBadge: {
    backgroundColor: colors.status.success,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Groups
  groupsContent: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 110 : 90,
    gap: spacing.lg,
  },
  groupCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.bg.elevated,
  },
  groupHeader: {
    backgroundColor: WC_GOLD_DIM,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: WC_GOLD_BORDER,
  },
  groupHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: WC_GOLD,
    letterSpacing: 0.5,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.bg.elevated,
  },
  standingRowLast: {
    borderBottomWidth: 0,
  },
  standingTeamCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  posBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  posBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 12,
  },
  standingTeamName: {
    fontSize: 11,
    color: colors.text.primary,
    flex: 1,
  },
  standingStatCol: {
    width: 24,
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  standingColHeader: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: '600',
    textAlign: 'center',
    width: 24,
  },
  standingPtsText: {
    color: WC_GOLD,
    fontWeight: '700',
    fontSize: 12,
  },

  // Bracket
  bracketContent: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 110 : 90,
  },
  bracketRoundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  bracketRoundLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.bg.elevated,
  },
  bracketRoundTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
