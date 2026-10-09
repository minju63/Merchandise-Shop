import { supabase } from '../lib/supabase.js';

export async function getStoreImages(storeIds) {
  if (!storeIds.length) return [];
  const { data, error } = await supabase.from('store_images').select('*').in('store_id', storeIds);
  if (error) throw error;
  return data || [];
}
