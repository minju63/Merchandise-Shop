import { supabase } from '../lib/supabase.js';

function unwrap(result) {
  if (result.error) throw result.error;
  return result.data || [];
}

export async function listActiveStores() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const batch = unwrap(
      await supabase
        .from('stores')
        .select('*')
        .eq('status', 'ACTIVE')
        .range(from, from + 999)
    );
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

export async function getActiveStore(storeId) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  if (error) throw error;
  return data;
}
