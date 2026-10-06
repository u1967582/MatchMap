import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '~/utils/supabase';
import { toast } from '~/components/ds';
import { buildBroadcastPreferencesPayload, teamSelectionKey as teamKey } from '~/lib/broadcastPreferences';

export type Competition = { id: number | string; name: string; gender?: string | null };
export type Team = { id: string; name: string; short_name?: string | null; logo_url?: string | null };

interface UseAutoBroadcastPreferencesOptions {
  barId: string | undefined;
  /**
   * Si true, guarda siempre con fn_sync_bar_preferences_admin sin comprobar
   * el rol del usuario (pantallas exclusivas de super admin).
   */
  forceAdminRpc?: boolean;
}

/**
 * Lógica de automatización de retransmisiones de un bar (liga completa o
 * equipos sueltos por competición), extraída de app/auto-broadcasts/[barId].tsx
 * para poder reutilizarse también como panel embebido en otras pantallas.
 */
export function useAutoBroadcastPreferences({ barId, forceAdminRpc = false }: UseAutoBroadcastPreferencesOptions) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loadingComps, setLoadingComps] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [teamsCache, setTeamsCache] = useState<Record<string, { loading: boolean; teams: Team[]; error?: string }>>({});
  const [selectedCompetitions, setSelectedCompetitions] = useState<Record<string, boolean>>({});
  // Cada entrada es "teamId|competitionId" — el equipo queda ligado a la competición donde se seleccionó.
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [origComps, setOrigComps] = useState<string[]>([]);
  const [origTeams, setOrigTeams] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const hasAutomation = origComps.length > 0 || origTeams.length > 0;
  const hasSelection = Object.values(selectedCompetitions).some(Boolean) || selectedTeams.size > 0;

  // A diferencia de hasSelection, hasChanges también es true al pasar de "algo"
  // a "nada" (desautomatizar la última competición), que es un guardado válido.
  const currentCompIds = Object.keys(selectedCompetitions).filter((id) => selectedCompetitions[id]).sort();
  const currentTeamKeys = Array.from(selectedTeams).sort();
  const sortedOrigComps = [...origComps].sort();
  const sortedOrigTeams = [...origTeams].sort();
  const hasChanges =
    currentCompIds.length !== sortedOrigComps.length ||
    currentTeamKeys.length !== sortedOrigTeams.length ||
    currentCompIds.some((id, i) => id !== sortedOrigComps[i]) ||
    currentTeamKeys.some((key, i) => key !== sortedOrigTeams[i]);

  const clearAll = useCallback(() => {
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
              const { error: eventsError } = await supabase
                .from('events')
                .delete()
                .eq('bar_id', barId)
                .eq('is_auto', true);
              if (eventsError) throw eventsError;
              await Promise.all([
                supabase.from('bar_selected_competitions').delete().eq('bar_id', barId),
                supabase.from('bar_selected_teams').delete().eq('bar_id', barId),
              ]);
              setSelectedCompetitions({});
              setSelectedTeams(new Set());
              setOrigComps([]);
              setOrigTeams([]);
              toast.success('Automatizaciones eliminadas');
            } catch (e: any) {
              console.error('[useAutoBroadcastPreferences] Clear all error:', e);
              toast.error('No se pudieron eliminar las automatizaciones');
            } finally {
              setClearingAll(false);
            }
          },
        },
      ],
    );
  }, [barId]);

  useEffect(() => {
    if (forceAdminRpc) return;
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
  }, [forceAdminRpc]);

  useEffect(() => {
    const loadCompetitions = async () => {
      setLoadingComps(true);
      try {
        const { data, error } = await supabase
          .from('competitions')
          .select('id,name,gender')
          .order('name', { ascending: true });
        if (error) throw error;
        setCompetitions((data ?? []).map((c: any) => ({ id: c.id, name: c.name, gender: c.gender })));

        if (barId) {
          const [compSel, teamSel] = await Promise.all([
            supabase.from('bar_selected_competitions').select('competition_id').eq('bar_id', barId),
            supabase.from('bar_selected_teams').select('team_id,competition_id').eq('bar_id', barId),
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
  }, [barId]);

  const toggleExpand = useCallback(async (compId: string | number) => {
    const key = String(compId);
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    if (!teamsCache[key]) {
      setTeamsCache((prev) => ({ ...prev, [key]: { loading: true, teams: [] } }));
      try {
        const { data: matchRows, error: matchesError } = await supabase
          .from('matches')
          .select('home_team_id,away_team_id', { head: false })
          .eq('competition_id', compId)
          .eq('status', 'scheduled')
          .limit(10000);
        if (matchesError) throw matchesError;
        const teamIds = Array.from(new Set((matchRows ?? []).flatMap((r: any) => [r.home_team_id, r.away_team_id]).filter(Boolean)));
        let teams: Team[] = [];
        if (teamIds.length > 0) {
          const { data: teamsData, error: teamsError } = await supabase
            .from('teams')
            .select('id,name,short_name,logo_url')
            .in('id', teamIds);
          if (teamsError) throw teamsError;
          teams = (teamsData ?? []).map((t: any) => ({ id: t.id, name: t.name, short_name: t.short_name, logo_url: t.logo_url }));
        }
        setTeamsCache((prev) => ({ ...prev, [key]: { loading: false, teams } }));
      } catch (e: any) {
        setTeamsCache((prev) => ({ ...prev, [key]: { loading: false, teams: [], error: 'No se pudieron cargar los equipos' } }));
      }
    }
  }, [teamsCache]);

  const toggleCompetitionSelected = useCallback((compId: string | number) => {
    setSelectedCompetitions((prev) => ({ ...prev, [String(compId)]: !prev[String(compId)] }));
  }, []);

  const toggleTeamSelected = useCallback((compId: string | number, teamId: string) => {
    const key = teamKey(teamId, compId);
    setSelectedTeams((prev) => {
      const updated = new Set(prev);
      if (updated.has(key)) updated.delete(key); else updated.add(key);
      return updated;
    });
  }, []);

  // No hace router.back() ni nada de navegación — eso es responsabilidad de
  // quien use el hook, ya que el panel embebido no debe navegar al guardar.
  const save = useCallback(async () => {
    if (!barId) return;
    setSaving(true);
    try {
      const { competition_ids, team_ids, team_competition_ids } = buildBroadcastPreferencesPayload(
        selectedCompetitions,
        selectedTeams,
      );

      const rpcFunction = forceAdminRpc || isSuperAdmin ? 'fn_sync_bar_preferences_admin' : 'fn_sync_bar_preferences';
      const { error } = await supabase.rpc(rpcFunction, {
        _bar_id: barId,
        _competition_ids: competition_ids,
        _team_ids: team_ids,
        _team_competition_ids: team_competition_ids,
      });
      if (error) throw error;

      setOrigComps(competition_ids);
      setOrigTeams(Array.from(selectedTeams));
      toast.success('Automatización activada');
    } catch (e: any) {
      console.error('[useAutoBroadcastPreferences] Save error:', e);
      toast.error('No se pudo guardar', e.message || 'Inténtalo de nuevo');
      throw e;
    } finally {
      setSaving(false);
    }
  }, [barId, selectedCompetitions, selectedTeams, isSuperAdmin, forceAdminRpc]);

  return {
    competitions,
    loadingComps,
    expanded,
    teamsCache,
    selectedCompetitions,
    selectedTeams,
    hasAutomation,
    hasSelection,
    hasChanges,
    toggleExpand,
    toggleCompetitionSelected,
    toggleTeamSelected,
    save,
    clearAll,
    saving,
    clearingAll,
  };
}
