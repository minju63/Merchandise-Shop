import { supabase } from '../lib/supabase.js';

export async function getStoreBusinessHours(storeIds) {
  if (!storeIds.length) return [];
  const { data, error } = await supabase
    .from('store_business_hours')
    .select('*')
    .in('store_id', storeIds);
  if (error) throw error;
  return data || [];
}
