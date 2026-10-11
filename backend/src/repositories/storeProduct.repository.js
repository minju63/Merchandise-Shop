import { supabase } from '../lib/supabase.js';

export async function getStoreProducts(storeIds) {
  if (!storeIds.length) return [];
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('store_products')
      .select('*')
      .in('store_id', storeIds)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}
