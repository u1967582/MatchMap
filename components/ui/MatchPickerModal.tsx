import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '~/components/ds';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import HorizontalDateScroller from './HorizontalDateScroller';

interface Team {
  id: string;
  name: string;
  gender: string;
  logo_url: string;
}

interface Competition {
  id: number;
  name: string;
  gender: string;
}

export interface Match {
  id: string;
  date: string;
  time: string;
  home_team_id: string;
  away_team_id: string;
  competition_id: number;
  status: string;
  home_team?: Team;
  away_team?: Team;
  competition?: Competition;
}

interface MatchPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectMatch: (match: Match | null) => void;
  selectedMatchId?: string | null;
}

// Helper function to get competition logo filename
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

export default function MatchPickerModal({
  visible,
  onClose,
  onSelectMatch,
  selectedMatchId,
}: MatchPickerModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [tempSelectedMatchId, setTempSelectedMatchId] = useState<string | null>(selectedMatchId || null);
  const [loading, setLoading] = useState(false);

  // Fetch matches for selected date
  const fetchMatchesForDate = async (date: Date) => {
    setLoading(true);
    try {
      // Format date as YYYY-MM-DD
      const dateString = date.getFullYear() + '-' + 
        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
        String(date.getDate()).padStart(2, '0');
      
      const today = new Date();
      const todayString = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
      
      console.log('📅 Fetching matches for date:', dateString);
      
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          date,
          time,
          home_team_id,
          away_team_id,
          competition_id,
          status
        `)
        .eq('date', dateString)
        .eq('status', 'scheduled')
        .gte('date', todayString)
        .order('time');

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        return;
      }

      console.log('📅 Raw matches found:', matchesData?.length || 0);
      
      if (matchesData && matchesData.length > 0) {
        // Get unique team IDs
        const teamIds = [...new Set([
          ...matchesData.map(m => m.home_team_id),
          ...matchesData.map(m => m.away_team_id)
        ])];

        // Get unique competition IDs
        const competitionIds = [...new Set(matchesData.map(m => m.competition_id))];

        // Fetch teams
        const { data: teamsData } = await supabase
          .from('teams')
          .select('id, name, gender, logo_url')
          .in('id', teamIds);

        // Fetch competitions
        const { data: competitionsData } = await supabase
          .from('competitions')
          .select('id, name, gender')
          .in('id', competitionIds);

        // Persist competitions for chips
        setCompetitions((competitionsData ?? []) as Competition[]);

        // Create maps for quick lookup
        const teamsMap = new Map();
        teamsData?.forEach(team => teamsMap.set(team.id, team));

        const competitionsMap = new Map();
        competitionsData?.forEach(comp => competitionsMap.set(comp.id, comp));

        // Enrich matches with team and competition data
        const enrichedMatches: Match[] = matchesData.map(match => ({
          ...match,
          home_team: teamsMap.get(match.home_team_id),
          away_team: teamsMap.get(match.away_team_id),
          competition: competitionsMap.get(match.competition_id),
        }));

        setMatches(enrichedMatches);
        console.log('⚽ Matches loaded:', enrichedMatches.length);
      } else {
        setMatches([]);
        setCompetitions([]);
        console.log('📅 No matches found for date:', dateString);
      }
    } catch (error) {
      console.error('Error in fetchMatchesForDate:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load matches for today when modal opens
  useEffect(() => {
    if (visible) {
      const today = new Date();
      setSelectedDate(today);
      setTempSelectedMatchId(selectedMatchId || null);
      fetchMatchesForDate(today);
    }
  }, [visible, selectedMatchId]);

  // Reload matches when date changes
  useEffect(() => {
    if (visible) {
      fetchMatchesForDate(selectedDate);
    }
  }, [selectedDate]);

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleApply = () => {
    if (tempSelectedMatchId) {
      const selectedMatch = matches.find(m => m.id === tempSelectedMatchId);
      onSelectMatch(selectedMatch || null);
    } else {
      onSelectMatch(null);
    }
    onClose();
  };

  const handleClearSelection = () => {
    setTempSelectedMatchId(null);
    onSelectMatch(null);
    onClose();
  };

  const renderMatchItem = ({ item }: { item: Match }) => {
    const isSelected = tempSelectedMatchId === item.id;

    return (
      <TouchableOpacity
        style={[styles.matchCard, isSelected && styles.matchCardSelected]}
        onPress={() => setTempSelectedMatchId(isSelected ? null : item.id)}
      >
        <View style={styles.matchHeader}>
          <View style={styles.teamsContainer}>
            <View style={styles.teamContainer}>
              <Image
                source={{
                  uri: item.home_team?.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${item.home_team_id}.png`
                }}
                style={styles.teamLogo}
              />
              <AppText style={styles.teamName} numberOfLines={1}>
                {item.home_team?.name || 'Equipo Local'}
              </AppText>
            </View>

            <View style={styles.vsContainer}>
              <AppText style={styles.vsText}>VS</AppText>
            </View>

            <View style={styles.teamContainer}>
              <Image
                source={{
                  uri: item.away_team?.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${item.away_team_id}.png`
                }}
                style={styles.teamLogo}
              />
              <AppText style={styles.teamName} numberOfLines={1}>
                {item.away_team?.name || 'Equipo Visitante'}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.matchDetails}>
          <AppText style={styles.matchTime}>
            {new Date(`${item.date} ${item.time}`).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </AppText>
          <AppText style={styles.competitionName}>
            {item.competition?.name || 'Competición'}
          </AppText>
        </View>

        {isSelected && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const filteredMatches = selectedCompetitionId == null
    ? matches
    : matches.filter(m => m.competition_id === selectedCompetitionId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <AppText style={styles.modalTitle}>Seleccionar Partido</AppText>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Horizontal Date Scroller */}
          <HorizontalDateScroller
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            minimumDate={new Date()}
            daysToShow={60}
          />

          {/* Competitions chips */}
          {competitions.length > 0 && (
            <View style={styles.competitionsContainer}>
              <FlatList
                data={[{ id: -1, name: 'Todas', gender: '' } as Competition, ...competitions]}
                keyExtractor={(item) => String(item.id)}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isAll = item.id === -1;
                  const selected = isAll ? selectedCompetitionId === null : selectedCompetitionId === item.id;
                  const label = isAll ? 'Todas' : item.name;
                  const logoFilename = !isAll ? getCompetitionLogoFilename(item.name) : null;
                  const logoUrl = logoFilename
                    ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo-teams/${logoFilename}`
                    : null;

                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedCompetitionId(isAll ? null : item.id)}
                      style={[
                        styles.competitionChip,
                        selected && styles.competitionChipSelected
                      ]}
                    >
                      {logoUrl && (
                        <Image
                          source={{ uri: logoUrl }}
                          style={styles.competitionChipLogo}
                          defaultSource={require('~/assets/icon.png')}
                        />
                      )}
                      <AppText style={[
                        styles.competitionChipText,
                        selected && styles.competitionChipTextSelected,
                      ]}>
                        {label}
                      </AppText>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {/* Matches List */}
          <View style={styles.matchesContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFFFFF" size="large" />
                <AppText style={styles.loadingText}>Cargando partidos...</AppText>
              </View>
            ) : filteredMatches.length > 0 ? (
              <FlatList
                data={filteredMatches}
                renderItem={renderMatchItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.matchesList}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="football-outline" size={80} color="rgba(255, 255, 255, 0.2)" />
                <AppText style={styles.emptyText}>
                  No hay partidos programados para esta fecha
                </AppText>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.modalButtonsRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={handleClearSelection}
            >
              <AppText style={styles.modalButtonText}>Quitar selección</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleApply}
              disabled={loading}
            >
              <AppText style={styles.modalButtonText}>Aplicar</AppText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modalContainer: {
    width: '100%',
    flex: 1,
    backgroundColor: '#1A2332',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  competitionsContainer: {
    marginBottom: 16,
    marginTop: 4,
  },
  competitionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0,
    gap: 6,
  },
  competitionChipSelected: {
    backgroundColor: '#1976D2',
    borderWidth: 0,
  },
  competitionChipLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    resizeMode: 'contain',
  },
  competitionChipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    fontSize: 13,
  },
  competitionChipTextSelected: {
    color: '#FFFFFF',
  },
  matchesContainer: {
    flex: 1,
    minHeight: 200,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 17,
    marginTop: 16,
  },
  matchesList: {
    paddingBottom: 8,
  },
  matchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  matchCardSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  matchHeader: {
    marginBottom: 8,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 80,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  teamLogo: {
    width: 52,
    height: 52,
    marginBottom: 6,
    resizeMode: 'contain',
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  vsContainer: {
    paddingHorizontal: 10,
  },
  vsText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  matchDetails: {
    alignItems: 'center',
    marginTop: 2,
  },
  matchTime: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  competitionName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 17,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#1976D2',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

