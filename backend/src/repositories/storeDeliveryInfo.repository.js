import { supabase } from '../lib/supabase.js';

export async function getStoreDeliveryInfos(storeIds) {
  if (!storeIds.length) return [];
  const { data, error } = await supabase
    .from('store_delivery_infos')
    .select('*')
    .in('store_id', storeIds);
  if (error) throw error;
  return data || [];
}
