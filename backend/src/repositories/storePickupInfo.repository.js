import { supabase } from '../lib/supabase.js';

export async function getStorePickupInfos(storeIds) {
  if (!storeIds.length) return [];
  const { data, error } = await supabase
    .from('store_pickup_infos')
    .select('*')
    .in('store_id', storeIds);
  if (error) throw error;
  return data || [];
}
