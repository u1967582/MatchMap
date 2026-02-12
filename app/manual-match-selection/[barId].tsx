import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import CustomCalendar from '~/components/ui/CustomCalendar';
import { getBarTierAndCapabilities } from '~/lib/getBarPlanInfo';
import { type Capabilities, CAP_BY_TIER, type Tier } from '~/lib/planCapabilities';
import { toast } from '~/components/ds';

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

interface Match {
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
  isSelected?: boolean;
}

const { width } = Dimensions.get('window');

// Helper function to get competition logo filename
function getCompetitionLogoFilename(compName: string): string | null {
  const nameLower = compName.toLowerCase();

  if (nameLower.includes('champions')) return 'champions.png';
  if (nameLower.includes('liga f')) return 'ligaf.png';
  if (nameLower.includes('primera') && (nameLower.includes('división') || nameLower.includes('division'))) {
    return 'primera-division-ea.png';
  }
  if (nameLower.includes('segunda') && (nameLower.includes('división') || nameLower.includes('division'))) {
    return 'segunda-division-hypermotion.png';
  }

  return null;
}

export default function ManualMatchSelectionScreen() {
  const router = useRouter();
  const { barId } = useLocalSearchParams<{ barId: string }>();
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matches, setMatches] = useState<Match[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<number | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [planTier, setPlanTier] = useState<Tier>('free');
  const [capabilities, setCapabilities] = useState<Capabilities>(CAP_BY_TIER.free);

  // Fetch matches for selected date
  const fetchMatchesForDate = async (date: Date) => {
    setLoading(true);
    try {
      // Format date as YYYY-MM-DD to match database format
      const dateString = date.getFullYear() + '-' + 
        String(date.getMonth() + 1).padStart(2, '0') + '-' + 
        String(date.getDate()).padStart(2, '0');
      
      const today = new Date();
      const todayString = today.getFullYear() + '-' + 
        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
        String(today.getDate()).padStart(2, '0');
      
              console.log('📅 Fetching matches for date:', dateString);
        console.log('📅 Today is:', todayString);
      
      // Get matches for the selected date
      console.log('🔍 Query filters: date=', dateString, 'status=scheduled, date>=', todayString);
      
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
        .gte('date', todayString) // Only future matches (including today)
        .order('time');

      if (matchesError) {
        console.error('Error fetching matches:', matchesError);
        toast.error('No se pudieron cargar los partidos');
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
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name, gender, logo_url')
          .in('id', teamIds);

        if (teamsError) {
          console.error('Error fetching teams:', teamsError);
          toast.error('No se pudieron cargar los equipos');
          return;
        }

        // Fetch competitions
        const { data: competitionsData, error: competitionsError } = await supabase
          .from('competitions')
          .select('id, name, gender')
          .in('id', competitionIds);

        if (competitionsError) {
          console.error('Error fetching competitions:', competitionsError);
          toast.error('No se pudieron cargar las competiciones');
          return;
        }

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
          isSelected: false,
        }));

        setMatches(enrichedMatches);
        console.log('⚽ Matches loaded:', enrichedMatches.length);
        console.log('⚽ First match example:', enrichedMatches[0]);
      } else {
        setMatches([]);
        console.log('📅 No matches found for date:', dateString);
        console.log('📅 Check if there are any matches in the database for this date');
      }
    } catch (error) {
      console.error('Error in fetchMatchesForDate:', error);
      Alert.alert('Error', 'Ocurrió un error al cargar los partidos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatchesForDate(selectedDate);
  }, [selectedDate]);

  // Load bar plan capabilities
  useEffect(() => {
    const loadCapabilities = async () => {
      if (!barId) return;
      try {
        const { tier, capabilities } = await getBarTierAndCapabilities(String(barId));
        setPlanTier(tier);
        setCapabilities(capabilities);
      } catch (e) {
        // Fallback to free
        setPlanTier('free');
        setCapabilities(CAP_BY_TIER.free);
      }
    };
    loadCapabilities();
  }, [barId]);



  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    // Keep selected matches from other dates, just load new matches for this date
  };

  const toggleMatchSelection = (match: Match) => {
    setSelectedMatches(prev => {
      const isAlreadySelected = prev.some(selected => selected.id === match.id);
      
      if (isAlreadySelected) {
        // Remove from selected matches
        return prev.filter(selected => selected.id !== match.id);
      } else {
        // Add to selected matches
        return [...prev, match];
      }
    });
  };

  const handleSaveSelectedMatches = async () => {
    if (selectedMatches.length === 0) {
      toast.info('Selecciona al menos un partido');
      return;
    }

    setSaving(true);
    try {
      // Enforce events_limit per bar plan
      const maxEvents = capabilities.events_limit === 'unlimited' ? Infinity : capabilities.events_limit;
      if (maxEvents !== Infinity) {
        const { count } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('bar_id', barId)
          .gte('start_time', new Date().toISOString());
        if (typeof count === 'number' && count + selectedMatches.length > maxEvents) {
          const remaining = Math.max(0, (maxEvents as number) - count);
          // Usar Alert aquí porque es un límite del plan (importante)
          Alert.alert(
            'Límite de eventos alcanzado',
            `Tu plan ${planTier} permite máximo ${maxEvents} eventos. ${remaining === 0 ? 'No puedes añadir más eventos.' : `Solo puedes añadir ${remaining} más.`}`
          );
          setSaving(false);
          return;
        }
      }

      // Insert selected matches into events table
      const eventsToInsert = selectedMatches.map(match => ({
        bar_id: barId,
        match_id: match.id,
        start_time: `${match.date} ${match.time}`,
      }));

      const { error } = await supabase
        .from('events')
        .insert(eventsToInsert);

      if (error) {
        console.error('Error saving events:', error);
        toast.error('No se pudieron guardar los partidos');
        return;
      }

      const partidosText = selectedMatches.length === 1 ? 'Partido añadido' : `${selectedMatches.length} partidos añadidos`;
      toast.success(partidosText);
      router.back();
    } catch (error) {
      console.error('Error in handleSaveSelectedMatches:', error);
      toast.error('Error al guardar los partidos', 'Inténtalo de nuevo');
    } finally {
      setSaving(false);
    }
  };

  const renderMatchItem = ({ item }: { item: Match }) => (
    <View style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <View style={styles.teamsContainer}>
                    <View style={styles.teamContainer}>
            <Image
              source={{
                uri: item.home_team?.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${item.home_team_id}.png`
              }}
              style={styles.teamLogo}
              defaultSource={require('~/assets/icon.png')}
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
              defaultSource={require('~/assets/icon.png')}
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
      
      <TouchableOpacity
        style={[styles.selectButton, selectedMatches.some(selected => selected.id === item.id) && styles.selectButtonActive]}
        onPress={() => toggleMatchSelection(item)}
      >
        <Ionicons
          name={selectedMatches.some(selected => selected.id === item.id) ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selectedMatches.some(selected => selected.id === item.id) ? '#4CAF50' : '#A3B3CC'}
        />
        <Text style={[styles.selectButtonText, selectedMatches.some(selected => selected.id === item.id) && styles.selectButtonTextActive]}>
          {selectedMatches.some(selected => selected.id === item.id) ? 'Seleccionado' : 'Seleccionar'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const selectedMatchesCount = selectedMatches.length;
  const filteredMatches = selectedCompetitionId == null
    ? matches
    : matches.filter(m => m.competition_id === selectedCompetitionId);

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seleccionar Partidos</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Calendar Section */}
      {showCalendar && (
        <>
          <CustomCalendar
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            minimumDate={new Date()}
          />
          <TouchableOpacity
            onPress={() => setShowCalendar(false)}
            style={{
              alignSelf: 'center',
              marginTop: 4,
              backgroundColor: '#1E3A5F',
              borderRadius: 16,
              padding: 6,
            }}
          >
            <Ionicons name="chevron-up" size={20} color="#A3B3CC" />
          </TouchableOpacity>
        </>
      )}

      {!showCalendar && (
        <TouchableOpacity
          onPress={() => setShowCalendar(true)}
          style={{
            alignSelf: 'center',
            marginVertical: 8,
            backgroundColor: '#1E3A5F',
            borderRadius: 16,
            padding: 6,
          }}
        >
          <Ionicons name="chevron-down" size={20} color="#A3B3CC" />
        </TouchableOpacity>
      )}

      {/* Competitions chips */}
      {competitions.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginTop: 8, marginBottom: 8 }}>
          <FlatList
            data={[{ id: -1, name: 'Todas', gender: '' } as Competition, ...competitions]}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const isAll = item.id === -1;
              const selected = isAll ? selectedCompetitionId === null : selectedCompetitionId === item.id;
              const label = isAll ? 'Todas' : item.name;

              // Get competition logo
              const logoFilename = isAll ? null : getCompetitionLogoFilename(item.name);
              const compLogo = logoFilename
                ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo-teams/${logoFilename}`
                : null;

              return (
                <TouchableOpacity
                  onPress={() => setSelectedCompetitionId(isAll ? null : item.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 16,
                    marginRight: 12,
                    backgroundColor: selected ? '#1976D2' : '#1E3A5F',
                    borderWidth: selected ? 0 : 1,
                    borderColor: '#28415F',
                  }}
                >
                  {compLogo && (
                    <Image
                      source={{ uri: compLogo }}
                      style={{ width: 20, height: 20, borderRadius: 10 }}
                      defaultSource={require('~/assets/icon.png')}
                    />
                  )}
                  <Text style={{ color: selected ? '#FFFFFF' : '#A3B3CC', fontWeight: '600' }}>{label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Selected Matches Summary */}
      {selectedMatches.length > 0 && (
        <View style={styles.selectedMatchesSection}>
          <Text style={styles.selectedMatchesTitle}>
            Partidos seleccionados
          </Text>
                      <FlatList
              data={selectedMatches}
              renderItem={({ item }) => (
                <View style={styles.selectedMatchItem}>
                  <Text style={styles.selectedMatchText}>
                    {item.home_team?.name} vs {item.away_team?.name}
                  </Text>
                  <Text style={styles.selectedMatchDate}>
                    {new Date(`${item.date} ${item.time}`).toLocaleString('es-ES', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleMatchSelection(item)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.selectedMatchesList}
            />
        </View>
      )}

      {/* Matches List */}
      <View style={styles.matchesSection}>
        <Text style={styles.sectionTitle}>
          Partidos disponibles
        </Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Cargando partidos...</Text>
          </View>
        ) : filteredMatches.length > 0 ? (
          <FlatList
            data={filteredMatches}
            renderItem={renderMatchItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.matchesList}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={<View style={{ height: 12 }} />}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="football-outline" size={64} color="#8E8E93" />
            <Text style={styles.emptyText}>No hay partidos programados para esta fecha</Text>
          </View>
        )}
      </View>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, selectedMatchesCount === 0 && styles.saveButtonDisabled]}
          onPress={handleSaveSelectedMatches}
          disabled={selectedMatchesCount === 0 || saving}
        >
          <Ionicons name="save" size={20} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Guardando...' : `Guardar ${selectedMatchesCount} partido(s)`}
          </Text>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  headerSpacer: {
    width: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F2A45',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },






  matchesSection: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#8E8E93',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  matchesList: {
    paddingBottom: 20,
  },
  matchCard: {
    backgroundColor: '#15263A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  vsContainer: {
    paddingHorizontal: 16,
  },
  vsText: {
    color: '#A3B3CC',
    fontSize: 16,
    fontWeight: '600',
  },
  matchDetails: {
    alignItems: 'center',
    marginBottom: 16,
  },
  matchTime: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  competitionName: {
    color: '#A3B3CC',
    fontSize: 14,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  selectButtonActive: {
    backgroundColor: '#4CAF50',
  },
  selectButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  selectButtonTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E3A5F',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#8E8E93',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Selected matches styles
  selectedMatchesSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  selectedMatchesTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  selectedMatchesList: {
    paddingVertical: 8,
    paddingBottom: 16,
  },
  selectedMatchItem: {
    backgroundColor: '#15263A',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMatchText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  selectedMatchDate: {
    color: '#4CAF50',
    fontSize: 12,
    marginRight: 8,
  },
  removeButton: {
    padding: 4,
  },
}); 