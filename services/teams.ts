import { supabase } from '~/utils/supabase';

export interface TeamSearchResult {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
}

export async function searchTeams(q: string): Promise<TeamSearchResult[]> {
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from('teams')
    .select('id,name,short_name,logo_url')
    .or(`name.ilike.${like},short_name.ilike.${like}`)
    .order('name', { ascending: true })
    .limit(50);

  if (error) throw error;
  return (data as TeamSearchResult[]) ?? [];
}


