import { supabase } from '~/utils/supabase';

export async function fetchBarIdsByTeam(teamId: string, onlyFuture: boolean = true): Promise<string[]> {
  const { data, error } = await supabase.rpc('fn_bar_ids_with_team_events', {
    _team: teamId,
    _future_only: onlyFuture,
  });
  if (error) throw error;
  return (data ?? []).map((r: { bar_id: string }) => r.bar_id);
}

/**
 * Fetch bar IDs that have events for a specific match
 */
export async function fetchBarIdsByMatch(matchId: string): Promise<string[]> {
  try {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('events')
      .select('bar_id')
      .eq('match_id', matchId)
      .gte('start_time', now);
    
    if (error) throw error;
    
    // Return unique bar IDs
    const barIds = [...new Set(data?.map(e => e.bar_id) || [])];
    console.log(`📍 Found ${barIds.length} bars with events for match ${matchId}`);
    return barIds;
  } catch (error) {
    console.error('❌ Error fetching bar IDs by match:', error);
    throw error;
  }
}

/**
 * Create a pre-registered bar (cold registration by super user)
 * This inserts into auto_pre_register_bars table instead of bars table
 */
export async function createAutoPreRegisterBar(payload: {
  name: string;
  description?: string | null;
  email: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  door_number?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  category_id?: number | null;
  notes?: string | null;
}) {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Usuario no autenticado');
    }

    // Normalize email to lowercase for consistent matching
    const normalizedPayload = {
      ...payload,
      email: payload.email.toLowerCase().trim(),
    };

    console.log(`\n========================================`);
    console.log(`💾 GUARDANDO BAR PRE-REGISTRADO`);
    console.log(`========================================`);
    console.log(`📧 Email original: "${payload.email}"`);
    console.log(`📧 Email normalizado: "${normalizedPayload.email}"`);
    console.log(`   - Length: ${normalizedPayload.email.length}`);
    console.log(`   - Has spaces: ${normalizedPayload.email.includes(' ')}`);
    console.log(`🏢 Nombre del bar: ${normalizedPayload.name}`);
    console.log(`👤 Created by user: ${user.id}`);

    const insertPayload = {
      ...normalizedPayload,
      created_by_user_id: user.id,
      status: 'pre_registered',
    };

    console.log(`\n📦 Payload completo para INSERT:`);
    console.log(JSON.stringify(insertPayload, null, 2));

    // Insert into auto_pre_register_bars
    const { data, error } = await supabase
      .from('auto_pre_register_bars')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('\n❌ Error creating auto pre-register bar:', error);
      console.log(`========================================\n`);
      throw error;
    }

    console.log(`\n✅ BAR PRE-REGISTRADO EXITOSAMENTE!`);
    console.log(`   ID: ${data.id}`);
    console.log(`   Email guardado: "${data.email}"`);
    console.log(`   Status: ${data.status}`);
    console.log(`========================================\n`);
    
    return data;
  } catch (error) {
    console.error('❌ Error in createAutoPreRegisterBar:', error);
    throw error;
  }
}


