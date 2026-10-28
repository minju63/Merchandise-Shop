import { supabase } from '../lib/supabase.js';

export async function listRegions() {
  const { data, error } = await supabase.from('regions').select('id,name').order('name');
  if (error) throw error;
  return data || [];
}

export async function getRegions(regionIds) {
  if (!regionIds.length) return [];
  const { data, error } = await supabase.from('regions').select('*').in('id', regionIds);
  if (error) throw error;
  return data || [];
}
