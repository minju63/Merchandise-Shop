// 담당: 동균
// 테이블: wishlist_products
import { supabase } from '../lib/supabase.js';

// TODO: wishlist_products 조회 · 저장 함수

export async function findStoreProductIds({ userId, storeProductIds }) {
  if (!storeProductIds.length) return [];
  const { data, error } = await supabase.from('wishlist_products')
    .select('store_product_id').eq('user_id', userId).in('store_product_id', storeProductIds);
  if (error) throw error;
  return (data || []).map(row => row.store_product_id);
}
