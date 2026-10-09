import { supabase } from '../lib/supabase.js';

export async function getProducts(productIds) {
  if (!productIds.length) return [];
  const { data, error } = await supabase.from('products').select('*').in('id', productIds);
  if (error) throw error;
  return data || [];
}
