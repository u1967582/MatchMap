import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';

type Competition = { id: number | string; name: string; gender?: string | null };
type Team = { id: string; name: string; short_name?: string | null; logo_url?: string | null };

export default function AutoBroadcastsScreen() {
	const router = useRouter();
	const { barId } = useLocalSearchParams<{ barId: string }>();

	const [competitions, setCompetitions] = useState<Competition[]>([]);
	const [loadingComps, setLoadingComps] = useState<boolean>(true);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [teamsCache, setTeamsCache] = useState<Record<string, { loading: boolean; teams: Team[]; error?: string }>>({});
	const [selectedCompetitions, setSelectedCompetitions] = useState<Record<string, boolean>>({});
	const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
	const [origComps, setOrigComps] = useState<string[]>([]);
	const [origTeams, setOrigTeams] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const selectedSummary = (() => {
		const comps = Object.values(selectedCompetitions).filter(Boolean).length;
		const teams = selectedTeams.size;
		return { comps, teams, total: comps + teams };
	})();
	const hasSelection = selectedSummary.total > 0;

	const dirty = React.useMemo(() => {
		const currentComps = Object.entries(selectedCompetitions).filter(([, v]) => v).map(([k]) => String(k)).sort().join(',');
		const origCompsStr = [...origComps].sort().join(',');
		const currentTeams = [...selectedTeams].sort().join(',');
		const origTeamsStr = [...origTeams].sort().join(',');
		return currentComps !== origCompsStr || currentTeams !== origTeamsStr;
	}, [selectedCompetitions, selectedTeams, origComps, origTeams]);

	const persistSelections = useCallback(async () => {
		if (!barId) return;
		const bar = String(barId);
		try {
			console.log('[AutoBroadcasts] Persist start', { bar, selectedCompetitions, selectedTeams: Array.from(selectedTeams) });
			// Build payloads
			const compIds = Object.entries(selectedCompetitions)
				.filter(([, checked]) => checked)
				.map(([id]) => ({ bar_id: bar, competition_id: /^\d+$/.test(id) ? Number(id) : id }));

			const teamIds: { bar_id: string; team_id: string }[] = Array.from(selectedTeams).map(tid => ({ bar_id: bar, team_id: tid }));
			console.log('[AutoBroadcasts] Payloads', { compIdsLen: compIds.length, teamIdsLen: teamIds.length });

			// Competitions insert with fallback plural/singular
			if (compIds.length > 0) {
				const trySing = await supabase.from('bar_selected_competition').insert(compIds).select();
				if (trySing.error) {
					console.log('[AutoBroadcasts] competitions singular failed', trySing.error);
					const tryPlural = await supabase.from('bar_selected_competitions').insert(compIds).select();
					console.log('[AutoBroadcasts] competitions plural result', { count: tryPlural.data?.length, error: tryPlural.error });
					if (tryPlural.error) throw tryPlural.error;
				} else {
					console.log('[AutoBroadcasts] competitions singular result', { count: trySing.data?.length });
				}
			}
			if (teamIds.length > 0) {
				const resTeams = await supabase.from('bar_selected_teams').insert(teamIds).select();
				console.log('[AutoBroadcasts] teams insert result', { count: resTeams.data?.length, error: resTeams.error });
				if (resTeams.error) {
					const resTeamsSing = await supabase.from('bar_selected_team').insert(teamIds).select();
					console.log('[AutoBroadcasts] teams singular insert result', { count: resTeamsSing.data?.length, error: resTeamsSing.error });
					if (resTeamsSing.error) throw resTeamsSing.error;
				}
			}

				// Volver al perfil con toast de éxito
			toast.success('Automatización activada');
			router.back();
		} catch (e: any) {
			console.error('Persist selections error:', e);
			toast.error('No se pudieron guardar las selecciones');
		}
	}, [barId, selectedCompetitions, selectedTeams]);

	useEffect(() => {
		const loadCompetitions = async () => {
			setLoadingComps(true);
			try {
				const { data, error } = await supabase
					.from('competitions')
					.select('id,name,gender')
					.order('name', { ascending: true });
				if (error) throw error;
				setCompetitions((data ?? []).map(c => ({ id: c.id, name: c.name, gender: (c as any).gender })));
				// Cargar selecciones existentes
				if (barId) {
					const bar = String(barId);
					const [compSel, teamSel] = await Promise.all([
						supabase.from('bar_selected_competitions').select('competition_id').eq('bar_id', bar),
						supabase.from('bar_selected_teams').select('team_id').eq('bar_id', bar),
					]);
					const compMap: Record<string, boolean> = {};
					const compArr: string[] = [];
					compSel.data?.forEach((row: any) => { const id = String(row.competition_id); compMap[id] = true; compArr.push(id); });
					setSelectedCompetitions(compMap);
					setOrigComps(compArr);
					const teamSet = new Set<string>();
					const teamArr: string[] = [];
					teamSel.data?.forEach((row: any) => { const id = String(row.team_id); teamSet.add(id); teamArr.push(id); });
					setSelectedTeams(teamSet);
					setOrigTeams(teamArr);
				}
			} catch (e) {
				setCompetitions([]);
			} finally {
				setLoadingComps(false);
			}
		};
		loadCompetitions();
	}, []);

	const toggleExpand = useCallback(async (compId: string | number) => {
		const key = String(compId);
		setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
		if (!teamsCache[key]) {
			// load teams participating in this competition from matches → teams
			setTeamsCache(prev => ({ ...prev, [key]: { loading: true, teams: [] } }));
			try {
				const { data: matchRows, error: matchesError } = await supabase
					.from('matches')
					.select('home_team_id,away_team_id', { head: false })
					.eq('competition_id', compId)
					.limit(10000);
				if (matchesError) throw matchesError;
				const teamIds = Array.from(new Set((matchRows ?? []).flatMap(r => [r.home_team_id, r.away_team_id]).filter(Boolean)));
				let teams: Team[] = [];
				if (teamIds.length > 0) {
					const { data: teamsData, error: teamsError } = await supabase
						.from('teams')
						.select('id,name,short_name,logo_url')
						.in('id', teamIds);
					if (teamsError) throw teamsError;
					teams = (teamsData ?? []).map(t => ({ id: t.id, name: t.name, short_name: (t as any).short_name, logo_url: (t as any).logo_url }));
				}
				setTeamsCache(prev => ({ ...prev, [key]: { loading: false, teams } }));
			} catch (e: any) {
				setTeamsCache(prev => ({ ...prev, [key]: { loading: false, teams: [], error: 'No se pudieron cargar los equipos' } }));
			}
		}
	}, [teamsCache]);

	const toggleCompetitionSelected = useCallback((compId: string | number) => {
		const key = String(compId);
		setSelectedCompetitions(prev => ({ ...prev, [key]: !prev[key] }));
	}, []);

	const toggleTeamSelected = useCallback((_compId: string | number, teamId: string) => {
		setSelectedTeams(prev => {
			const updated = new Set(prev);
			if (updated.has(teamId)) updated.delete(teamId); else updated.add(teamId);
			return updated;
		});
	}, []);

	const onSave = useCallback(async () => {
		if (!barId) return;
		try {
			setSaving(true);
			const bar = String(barId);
			const competition_ids = Object.entries(selectedCompetitions).filter(([, v]) => v).map(([k]) => (/^\d+$/.test(k) ? Number(k) : k));
			const team_ids = Array.from(selectedTeams);
			const { error } = await supabase.rpc('fn_sync_bar_preferences', {
				_bar_id: bar,
				_competition_ids: competition_ids,
				_team_ids: team_ids,
			});
				if (error) throw error;
			setOrigComps(competition_ids.map(String));
			setOrigTeams(team_ids.map(String));
			// Volver al perfil del bar tras guardar con toast de éxito
			toast.success('Automatización activada');
			router.back();
		} catch (e: any) {
			toast.error('No se pudo guardar', 'Inténtalo de nuevo');
		} finally {
			setSaving(false);
		}
	}, [barId, selectedCompetitions, selectedTeams]);

	const renderCompetition = ({ item }: { item: Competition }) => {
		const key = String(item.id);
		const isOpen = !!expanded[key];
		const cache = teamsCache[key];
		const compChecked = !!selectedCompetitions[key];
		return (
			<View style={styles.compCard}>
				<View style={styles.compHeader}>
					<TouchableOpacity onPress={() => toggleCompetitionSelected(item.id)} style={styles.checkboxBtn}>
						<Ionicons name={compChecked ? 'checkbox' : 'square-outline'} size={20} color={compChecked ? '#4CAF50' : '#A3B3CC'} />
					</TouchableOpacity>
					<TouchableOpacity onPress={() => toggleExpand(item.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
						<Text style={styles.compTitle}>{item.name}</Text>
						<Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#A3B3CC" />
					</TouchableOpacity>
				</View>
				{isOpen && (
					<View style={styles.compBody}>
						{compChecked ? (
							<Text style={styles.badgeAll}>Liga completa seleccionada</Text>
						) : cache?.loading ? (
							<View style={styles.loadingRow}><ActivityIndicator color="#A3B3CC" /></View>
						) : cache?.error ? (
							<Text style={styles.errorText}>{cache.error}</Text>
						) : cache && cache.teams.length === 0 ? (
							<Text style={styles.emptyText}>No hay equipos disponibles</Text>
						) : (
							<FlatList
								data={cache?.teams ?? []}
								keyExtractor={(t) => t.id}
								scrollEnabled={false}
								renderItem={({ item: team }) => {
									const logo = team.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${team.id}.png`;
									const isChecked = selectedTeams.has(team.id);
									return (
										<View style={styles.teamRow}>
											<Image source={{ uri: logo }} style={styles.teamLogo} defaultSource={require('~/assets/icon.png')} />
											<Text style={styles.teamName}>{team.name}</Text>
											<TouchableOpacity onPress={() => toggleTeamSelected(item.id, team.id)} style={styles.checkboxBtn}>
												<Ionicons name={isChecked ? 'checkbox' : 'square-outline'} size={20} color={isChecked ? '#4CAF50' : '#A3B3CC'} />
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
		<SafeAreaView style={styles.container} edges={["top","bottom"]}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Ionicons name="arrow-back" size={24} color="#FFFFFF" />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Automatizar retransmisiones</Text>
				<View style={{ width: 40 }} />
			</View>

			{loadingComps ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#A3B3CC" />
				</View>
			) : (
				<FlatList
					data={competitions}
					renderItem={renderCompetition}
					keyExtractor={(c) => String(c.id)}
					contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
				/>
			)}

			<View style={styles.footer}>
				<TouchableOpacity
					style={[styles.primaryButton, (!hasSelection || saving) && styles.primaryButtonDisabled]}
					disabled={!hasSelection || saving}
					onPress={onSave}
				>
					<Ionicons name="save-outline" size={20} color="#FFFFFF" />
					<Text style={styles.primaryButtonText}>{saving ? 'Guardando…' : 'Guardar preferencias'}</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#1C2A3A' },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingVertical: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#1E3A5F',
	},
	backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0F2A45', justifyContent: 'center', alignItems: 'center' },
	headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
	loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	compCard: { backgroundColor: '#15263A', borderRadius: 12, padding: 12, marginBottom: 12 },
	compHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	compTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
	compBody: { marginTop: 10 },
	loadingRow: { paddingVertical: 8 },
	teamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
	teamLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 10, resizeMode: 'contain' },
	teamName: { color: '#FFFFFF', fontSize: 14, fontWeight: '500', flex: 1 },
	checkboxBtn: { paddingHorizontal: 8, paddingVertical: 4 },
	errorText: { color: '#FF6B6B', fontSize: 14 },
	emptyText: { color: '#A3B3CC', fontSize: 14 },
	badgeAll: { color: '#A3B3CC', backgroundColor: '#0F2A45', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, alignSelf: 'flex-start' },
	footer: {
		padding: 20,
		borderTopWidth: 1,
		borderTopColor: '#1E3A5F',
	},
	primaryButton: {
		backgroundColor: '#10B981',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		borderRadius: 10,
		gap: 10,
	},
	primaryButtonDisabled: {
		backgroundColor: '#8E8E93',
	},
	primaryButtonText: {
		color: '#FFFFFF',
		fontSize: 15,
		fontWeight: '600',
	},
});


