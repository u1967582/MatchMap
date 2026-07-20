import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import { buildBroadcastPreferencesPayload, teamSelectionKey as teamKey } from '~/lib/broadcastPreferences';

type Competition = { id: number | string; name: string; gender?: string | null };
type Team = { id: string; name: string; short_name?: string | null; logo_url?: string | null };

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

export default function AutoBroadcastsScreen() {
	const router = useRouter();
	const { barId } = useLocalSearchParams<{ barId: string }>();

	const [competitions, setCompetitions] = useState<Competition[]>([]);
	const [loadingComps, setLoadingComps] = useState<boolean>(true);
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});
	const [teamsCache, setTeamsCache] = useState<Record<string, { loading: boolean; teams: Team[]; error?: string }>>({});
	const [selectedCompetitions, setSelectedCompetitions] = useState<Record<string, boolean>>({});
	// Cada entrada és "teamId|competitionId" — l'equip queda lligat a la competició on es va seleccionar
	const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
	const [origComps, setOrigComps] = useState<string[]>([]);
	const [origTeams, setOrigTeams] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [clearingAll, setClearingAll] = useState(false);
	const [isSuperAdmin, setIsSuperAdmin] = useState(false);

	const hasAutomation = origComps.length > 0 || origTeams.length > 0;
	const hasSelection = Object.values(selectedCompetitions).some(Boolean) || selectedTeams.size > 0;

	// --------------------------------------------------------
	// Eliminar totes les automatitzacions
	// --------------------------------------------------------
	const handleClearAll = useCallback(() => {
		Alert.alert(
			'Eliminar automatizaciones',
			'Se borrarán todos los partidos automatizados y las preferencias guardadas.\n\nLos partidos añadidos manualmente no se verán afectados.',
			[
				{ text: 'Cancelar', style: 'cancel' },
				{
					text: 'Eliminar todo',
					style: 'destructive',
					onPress: async () => {
						if (!barId) return;
						try {
							setClearingAll(true);
							const bar = String(barId);
							const { error: eventsError } = await supabase
								.from('events')
								.delete()
								.eq('bar_id', bar)
								.eq('is_auto', true);
							if (eventsError) throw eventsError;
							await Promise.all([
								supabase.from('bar_selected_competitions').delete().eq('bar_id', bar),
								supabase.from('bar_selected_teams').delete().eq('bar_id', bar),
							]);
							setSelectedCompetitions({});
							setSelectedTeams(new Set());
							setOrigComps([]);
							setOrigTeams([]);
							toast.success('Automatizaciones eliminadas');
						} catch (e: any) {
							console.error('[AutoBroadcasts] Clear all error:', e);
							toast.error('No se pudieron eliminar las automatizaciones');
						} finally {
							setClearingAll(false);
						}
					},
				},
			]
		);
	}, [barId]);

	// --------------------------------------------------------
	// Check super admin
	// --------------------------------------------------------
	useEffect(() => {
		const checkSuperAdmin = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;
			const { data, error } = await supabase
				.from('users')
				.select('is_super_user')
				.eq('id', user.id)
				.single();
			if (!error && data) setIsSuperAdmin(!!data.is_super_user);
		};
		checkSuperAdmin();
	}, []);

	// --------------------------------------------------------
	// Carregar competicions i seleccions existents
	// --------------------------------------------------------
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

				if (barId) {
					const bar = String(barId);
					const [compSel, teamSel] = await Promise.all([
						supabase.from('bar_selected_competitions').select('competition_id').eq('bar_id', bar),
						// Ara seleccionem també competition_id de cada equip
						supabase.from('bar_selected_teams').select('team_id,competition_id').eq('bar_id', bar),
					]);

					const compMap: Record<string, boolean> = {};
					const compArr: string[] = [];
					compSel.data?.forEach((row: any) => {
						const id = String(row.competition_id);
						compMap[id] = true;
						compArr.push(id);
					});
					setSelectedCompetitions(compMap);
					setOrigComps(compArr);

					const teamSet = new Set<string>();
					const teamArr: string[] = [];
					teamSel.data?.forEach((row: any) => {
						const key = teamKey(row.team_id, row.competition_id);
						teamSet.add(key);
						teamArr.push(key);
					});
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

	// --------------------------------------------------------
	// Expandir competició i carregar equips
	// --------------------------------------------------------
	const toggleExpand = useCallback(async (compId: string | number) => {
		const key = String(compId);
		setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
		if (!teamsCache[key]) {
			setTeamsCache(prev => ({ ...prev, [key]: { loading: true, teams: [] } }));
			try {
				const { data: matchRows, error: matchesError } = await supabase
					.from('matches')
					.select('home_team_id,away_team_id', { head: false })
					.eq('competition_id', compId)
					.eq('status', 'scheduled')
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
		setSelectedCompetitions(prev => ({ ...prev, [String(compId)]: !prev[String(compId)] }));
	}, []);

	// L'equip queda lligat a la competició on s'ha seleccionat
	const toggleTeamSelected = useCallback((compId: string | number, teamId: string) => {
		const key = teamKey(teamId, compId);
		setSelectedTeams(prev => {
			const updated = new Set(prev);
			if (updated.has(key)) updated.delete(key); else updated.add(key);
			return updated;
		});
	}, []);

	// --------------------------------------------------------
	// Guardar preferències
	// --------------------------------------------------------
	const onSave = useCallback(async () => {
		if (!barId) return;
		try {
			setSaving(true);
			const bar = String(barId);

			const { competition_ids, team_ids, team_competition_ids } = buildBroadcastPreferencesPayload(
				selectedCompetitions,
				selectedTeams
			);

			const rpcFunction = isSuperAdmin ? 'fn_sync_bar_preferences_admin' : 'fn_sync_bar_preferences';
			console.log(`[AutoBroadcasts] Using RPC: ${rpcFunction}`, { bar, competition_ids, team_ids, team_competition_ids });

			const { error } = await supabase.rpc(rpcFunction, {
				_bar_id:               bar,
				_competition_ids:      competition_ids,
				_team_ids:             team_ids,
				_team_competition_ids: team_competition_ids,
			});

			if (error) {
				console.error('[AutoBroadcasts] RPC error:', error);
				throw error;
			}

			setOrigComps(competition_ids);
			setOrigTeams(Array.from(selectedTeams));
			toast.success('Automatización activada');
			router.back();
		} catch (e: any) {
			console.error('[AutoBroadcasts] Save error:', e);
			toast.error('No se pudo guardar', e.message || 'Inténtalo de nuevo');
		} finally {
			setSaving(false);
		}
	}, [barId, selectedCompetitions, selectedTeams, isSuperAdmin]);

	// --------------------------------------------------------
	// Render
	// --------------------------------------------------------
	const renderCompetition = ({ item }: { item: Competition }) => {
		const key = String(item.id);
		const isOpen = !!expanded[key];
		const cache = teamsCache[key];
		const compChecked = !!selectedCompetitions[key];

		const logoFilename = getCompetitionLogoFilename(item.name) || 'default.png';
		const compLogo = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo-teams/${logoFilename}`;

		return (
			<View style={styles.compCard}>
				<View style={styles.compHeader}>
					<TouchableOpacity onPress={() => toggleCompetitionSelected(item.id)} style={styles.checkboxBtn}>
						<Ionicons name={compChecked ? 'checkbox' : 'square-outline'} size={20} color={compChecked ? '#4CAF50' : '#A3B3CC'} />
					</TouchableOpacity>
					<Image source={{ uri: compLogo }} style={styles.compLogo} defaultSource={require('~/assets/icon.png')} />
					<TouchableOpacity onPress={() => toggleExpand(item.id)} style={styles.compTitleContainer}>
						<AppText maxScale={1.1} numberOfLines={1} style={styles.compTitle}>{item.name}</AppText>
						<Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#A3B3CC" />
					</TouchableOpacity>
				</View>
				{isOpen && (
					<View style={styles.compBody}>
						{compChecked ? (
							<AppText style={styles.badgeAll}>Liga completa seleccionada</AppText>
						) : cache?.loading ? (
							<View style={styles.loadingRow}><ActivityIndicator color="#A3B3CC" /></View>
						) : cache?.error ? (
							<AppText style={styles.errorText}>{cache.error}</AppText>
						) : cache && cache.teams.length === 0 ? (
							<AppText style={styles.emptyText}>No hay equipos disponibles</AppText>
						) : (
							<FlatList
								data={cache?.teams ?? []}
								keyExtractor={(t) => t.id}
								scrollEnabled={false}
								renderItem={({ item: team }) => {
									const logo = team.logo_url || `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logo_teams/${team.id}.png`;
									// El checkbox verifica la clau "teamId|competitionId"
									const isChecked = selectedTeams.has(teamKey(team.id, item.id));
									return (
										<View style={styles.teamRow}>
											<Image source={{ uri: logo }} style={styles.teamLogo} defaultSource={require('~/assets/icon.png')} />
											<AppText style={styles.teamName}>{team.name}</AppText>
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
				<AppText style={styles.headerTitle}>Automatizar retransmisiones</AppText>
				{hasAutomation ? (
					<TouchableOpacity onPress={handleClearAll} disabled={clearingAll} style={styles.clearButton}>
						{clearingAll
							? <ActivityIndicator size="small" color="#FFFFFF" />
							: <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
						}
					</TouchableOpacity>
				) : (
					<View style={{ width: 40 }} />
				)}
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
					<AppText style={styles.primaryButtonText}>{saving ? 'Guardando…' : 'Guardar preferencias'}</AppText>
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
	clearButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#C0392B', justifyContent: 'center', alignItems: 'center' },
	headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
	loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	compCard: { backgroundColor: '#15263A', borderRadius: 12, padding: 12, marginBottom: 12 },
	compHeader: { flexDirection: 'row', alignItems: 'center' },
	compLogo: { width: 28, height: 28, borderRadius: 14, marginRight: 8, resizeMode: 'contain' },
	compTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	compTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
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
	primaryButtonDisabled: { backgroundColor: '#8E8E93' },
	primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
