import { supabase } from '../lib/supabase.js';

export async function getProductImages(productIds) {
  if (!productIds.length) return [];
  const { data, error } = await supabase
    .from('product_images')
    .select('*')
    .in('product_id', productIds);
  if (error) throw error;
  return data || [];
}
