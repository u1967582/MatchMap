import React, { useCallback } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { AppText } from '~/components/ds';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAutoBroadcastPreferences } from '~/hooks/useAutoBroadcastPreferences';
import { CompetitionsTeamsSelector } from '~/components/admin/CompetitionsTeamsSelector';

export default function AutoBroadcastsScreen() {
	const router = useRouter();
	const { barId } = useLocalSearchParams<{ barId: string }>();

	const {
		competitions, loadingComps, expanded, teamsCache,
		selectedCompetitions, selectedTeams, hasAutomation, hasChanges,
		toggleExpand, toggleCompetitionSelected, toggleTeamSelected,
		save, clearAll, saving, clearingAll,
	} = useAutoBroadcastPreferences({ barId: barId ? String(barId) : undefined });

	const handleSave = useCallback(async () => {
		try {
			await save();
			router.back();
		} catch {
			// el hook ya muestra el toast de error
		}
	}, [save, router]);

	// --------------------------------------------------------
	// Render
	// --------------------------------------------------------
	return (
		<SafeAreaView style={styles.container} edges={["top","bottom"]}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
					<Ionicons name="arrow-back" size={24} color="#FFFFFF" />
				</TouchableOpacity>
				<AppText style={styles.headerTitle}>Automatizar retransmisiones</AppText>
				{hasAutomation ? (
					<TouchableOpacity onPress={clearAll} disabled={clearingAll} style={styles.clearButton}>
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
				<CompetitionsTeamsSelector
					competitions={competitions}
					expanded={expanded}
					teamsCache={teamsCache}
					selectedCompetitions={selectedCompetitions}
					selectedTeams={selectedTeams}
					onToggleExpand={toggleExpand}
					onToggleCompetition={toggleCompetitionSelected}
					onToggleTeam={toggleTeamSelected}
					contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
				/>
			)}

			<View style={styles.footer}>
				<TouchableOpacity
					style={[styles.primaryButton, (!hasChanges || saving) && styles.primaryButtonDisabled]}
					disabled={!hasChanges || saving}
					onPress={handleSave}
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
