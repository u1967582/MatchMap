import React from 'react';
import { View, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AppText, colors as dsColors } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';
import { teamSelectionKey as teamKey } from '~/lib/broadcastPreferences';
import type { Competition, Team } from '~/hooks/useAutoBroadcastPreferences';

function getCompetitionLogoFilename(compName: string): string | null {
	const nameLower = compName.toLowerCase();
	if (nameLower.includes('champions') && (nameLower.includes('femen') || nameLower.includes('women') || nameLower.includes('mujer'))) return 'champions_femen.png';
	if (nameLower.includes('champions')) return 'champions.png';
	if (nameLower.includes('copa del rey')) return 'copa-del-rey.png';
	if (nameLower.includes('europa league')) return 'europa-league.png';
	if (nameLower.includes('liga f') || (nameLower.includes('primera') && (nameLower.includes('femen') || nameLower.includes('women') || nameLower.includes('mujer')))) return 'ligaf.png';
	if (nameLower.includes('primera') && (nameLower.includes('división') || nameLower.includes('division'))) return 'primera-division-ea.png';
	if (nameLower.includes('segunda') && (nameLower.includes('división') || nameLower.includes('division'))) return 'segunda-division-hypermotion.png';
	return null;
}

// 'dark': paleta oscura propia de /auto-broadcasts (pantalla completa).
// 'app': tokens del design system, para embeber en pantallas ya estilizadas con él.
type Variant = 'dark' | 'app';

const PALETTES: Record<Variant, {
  cardBg: string;
  title: string; muted: string; checked: string; error: string;
  badgeBg: string; badgeText: string;
}> = {
  dark: {
    cardBg: '#15263A',
    title: '#FFFFFF', muted: '#A3B3CC', checked: '#4CAF50', error: '#FF6B6B',
    badgeBg: '#0F2A45', badgeText: '#A3B3CC',
  },
  app: {
    cardBg: dsColors.bg.elevated,
    title: dsColors.text.primary, muted: dsColors.text.muted, checked: dsColors.status.success, error: dsColors.status.error,
    badgeBg: dsColors.bg.card, badgeText: dsColors.text.secondary,
  },
};

interface CompetitionsTeamsSelectorProps {
  competitions: Competition[];
  expanded: Record<string, boolean>;
  teamsCache: Record<string, { loading: boolean; teams: Team[]; error?: string }>;
  selectedCompetitions: Record<string, boolean>;
  selectedTeams: Set<string>;
  onToggleExpand: (compId: string | number) => void;
  onToggleCompetition: (compId: string | number) => void;
  onToggleTeam: (compId: string | number, teamId: string) => void;
  scrollEnabled?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  variant?: Variant;
}

export function CompetitionsTeamsSelector({
  competitions,
  expanded,
  teamsCache,
  selectedCompetitions,
  selectedTeams,
  onToggleExpand,
  onToggleCompetition,
  onToggleTeam,
  scrollEnabled = true,
  contentContainerStyle,
  variant = 'dark',
}: CompetitionsTeamsSelectorProps) {
  const p = PALETTES[variant];
  // 'app': filas sueltas separadas por una línea fina, sin tarjeta propia
  // (evita anidar tarjetas dentro de la tarjeta del panel que las contiene).
  const flat = variant === 'app';

  const renderCompetition = ({ item }: { item: Competition }) => {
    const key = String(item.id);
    const isOpen = !!expanded[key];
    const cache = teamsCache[key];
    const compChecked = !!selectedCompetitions[key];

    const logoFilename = getCompetitionLogoFilename(item.name) || 'default.png';
    const compLogo = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo-teams/${logoFilename}`;

    return (
      <View style={flat ? styles.compRowFlat : [styles.compCard, { backgroundColor: p.cardBg }]}>
        <View style={styles.compHeader}>
          <TouchableOpacity onPress={() => onToggleCompetition(item.id)} style={styles.checkboxBtn}>
            <Ionicons name={compChecked ? 'checkbox' : 'square-outline'} size={20} color={compChecked ? p.checked : p.muted} />
          </TouchableOpacity>
          <Image source={{ uri: compLogo }} style={styles.compLogo} defaultSource={require('~/assets/icon.png')} />
          <TouchableOpacity onPress={() => onToggleExpand(item.id)} style={styles.compTitleContainer}>
            <AppText maxScale={1.1} numberOfLines={1} style={[styles.compTitle, { color: p.title }]}>{item.name}</AppText>
            <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={p.muted} />
          </TouchableOpacity>
        </View>
        {isOpen && (
          <View style={styles.compBody}>
            {compChecked ? (
              <AppText style={[styles.badgeAll, { backgroundColor: p.badgeBg, color: p.badgeText }]}>Liga completa seleccionada</AppText>
            ) : cache?.loading ? (
              <View style={styles.loadingRow}><ActivityIndicator color={p.muted} /></View>
            ) : cache?.error ? (
              <AppText style={[styles.errorText, { color: p.error }]}>{cache.error}</AppText>
            ) : cache && cache.teams.length === 0 ? (
              <AppText style={[styles.emptyText, { color: p.muted }]}>No hay equipos disponibles</AppText>
            ) : (
              <FlatList
                data={cache?.teams ?? []}
                keyExtractor={(t) => t.id}
                scrollEnabled={false}
                renderItem={({ item: team }) => {
                  const logo = team.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${team.id}.png`;
                  const isChecked = selectedTeams.has(teamKey(team.id, item.id));
                  return (
                    <View style={styles.teamRow}>
                      <Image source={{ uri: logo }} style={styles.teamLogo} defaultSource={require('~/assets/icon.png')} />
                      <AppText style={[styles.teamName, { color: p.title }]}>{team.name}</AppText>
                      <TouchableOpacity onPress={() => onToggleTeam(item.id, team.id)} style={styles.checkboxBtn}>
                        <Ionicons name={isChecked ? 'checkbox' : 'square-outline'} size={20} color={isChecked ? p.checked : p.muted} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={competitions}
      renderItem={renderCompetition}
      keyExtractor={(c) => String(c.id)}
      scrollEnabled={scrollEnabled}
      contentContainerStyle={contentContainerStyle}
      ItemSeparatorComponent={flat ? () => <View style={styles.itemSeparator} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  compCard: { borderRadius: 12, padding: 12, marginBottom: 12 },
  compRowFlat: { paddingVertical: 10 },
  itemSeparator: { height: 1, backgroundColor: dsColors.border.subtle },
  compHeader: { flexDirection: 'row', alignItems: 'center' },
  compLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 8, resizeMode: 'contain' },
  compTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compTitle: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  compBody: { marginTop: 10 },
  loadingRow: { paddingVertical: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  teamLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 10, resizeMode: 'contain' },
  teamName: { fontSize: 14, fontWeight: '500', flex: 1 },
  checkboxBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  errorText: { fontSize: 14 },
  emptyText: { fontSize: 14 },
  badgeAll: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start' },
});
