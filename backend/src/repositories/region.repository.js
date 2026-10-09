import { supabase } from '../lib/supabase.js';

export async function getRegions(regionIds) {
  if (!regionIds.length) return [];
  const { data, error } = await supabase.from('regions').select('*').in('id', regionIds);
  if (error) throw error;
  return data || [];
}
