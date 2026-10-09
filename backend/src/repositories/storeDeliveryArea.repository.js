import { supabase } from '../lib/supabase.js';

export async function getStoreDeliveryAreas(storeIds) {
  if (!storeIds.length) return [];
  const { data, error } = await supabase
    .from('store_delivery_areas')
    .select('*')
    .in('store_id', storeIds);
  if (error) throw error;
  return data || [];
}
