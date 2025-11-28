import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
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

export default function MatchPickerModal({
  visible,
  onClose,
  onSelectMatch,
  selectedMatchId,
}: MatchPickerModalProps) {
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
              <Text style={styles.teamName} numberOfLines={2}>
                {item.home_team?.name || 'Equipo Local'}
              </Text>
            </View>
            
            <View style={styles.vsContainer}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            
            <View style={styles.teamContainer}>
              <Image
                source={{
                  uri: item.away_team?.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${item.away_team_id}.png`
                }}
                style={styles.teamLogo}
              />
              <Text style={styles.teamName} numberOfLines={2}>
                {item.away_team?.name || 'Equipo Visitante'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.matchDetails}>
          <Text style={styles.matchTime}>
            {new Date(`${item.date} ${item.time}`).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <Text style={styles.competitionName}>
            {item.competition?.name || 'Competición'}
          </Text>
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
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Seleccionar Partido</Text>
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
                  return (
                    <TouchableOpacity
                      onPress={() => setSelectedCompetitionId(isAll ? null : item.id)}
                      style={[
                        styles.competitionChip,
                        selected && styles.competitionChipSelected
                      ]}
                    >
                      <Text style={[
                        styles.competitionChipText,
                        selected && styles.competitionChipTextSelected
                      ]}>
                        {label}
                      </Text>
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
                <Text style={styles.loadingText}>Cargando partidos...</Text>
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
                <Text style={styles.emptyText}>
                  No hay partidos programados para esta fecha
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.modalButtonsRow}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={handleClearSelection}
            >
              <Text style={styles.modalButtonText}>Quitar selección</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleApply}
              disabled={loading}
            >
              <Text style={styles.modalButtonText}>Aplicar</Text>
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
    paddingTop: 50,
    paddingBottom: 20,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0,
  },
  competitionChipSelected: {
    backgroundColor: '#1976D2',
    borderWidth: 0,
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
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  matchCardSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  matchHeader: {
    marginBottom: 12,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  vsContainer: {
    paddingHorizontal: 12,
  },
  vsText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  matchDetails: {
    alignItems: 'center',
  },
  matchTime: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  competitionName: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
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

