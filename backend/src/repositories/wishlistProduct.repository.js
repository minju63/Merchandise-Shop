// 담당: 동균
// 테이블: wishlist_products
import { supabase } from '../lib/supabase.js';

const LIST_SELECT =
  'id,created_at,store_product:store_products!inner(*,product:products!inner(*),store:stores!inner(*))';

function check(error) {
  if (error)
    throw Object.assign(new Error('찜한 상품 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'WISHLIST_PRODUCT_QUERY_FAILED',
    });
}

export async function findStoreProductIds({ userId, storeProductIds }) {
  if (!storeProductIds.length) return [];
  const { data, error } = await supabase.from('wishlist_products')
    .select('store_product_id').eq('user_id', userId).in('store_product_id', storeProductIds);
  if (error) throw error;
  return (data || []).map(row => row.store_product_id);
}

// 숨김·삭제 판매상품과 폐점·삭제 매장은 목록과 totalCount 양쪽에서 제외한다.
export async function findPageByUser({ userId, page, size }) {
  const offset = (page - 1) * size;
  const { data, count, error } = await supabase
    .from('wishlist_products')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .not('store_product.status', 'in', '(HIDDEN,DELETED)')
    .not('store_product.store.status', 'in', '(CLOSED,DELETED)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + size - 1);
  check(error);
  return { rows: data ?? [], totalCount: count ?? 0 };
}

export async function countByUser(userId) {
  const { count, error } = await supabase
    .from('wishlist_products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  check(error);
  return count ?? 0;
}

// 이미 찜한 경우 아무 행도 돌려주지 않으므로 새로 등록됐는지 알 수 있다.
export async function insertIfAbsent({ userId, storeProductId }) {
  const { data, error } = await supabase
    .from('wishlist_products')
    .upsert(
      { user_id: userId, store_product_id: storeProductId },
      { onConflict: 'user_id,store_product_id', ignoreDuplicates: true },
    )
    .select('id');
  check(error);
  return (data ?? []).length > 0;
}

export async function remove({ userId, storeProductId }) {
  const { data, error } = await supabase
    .from('wishlist_products')
    .delete()
    .eq('user_id', userId)
    .eq('store_product_id', storeProductId)
    .select('id');
  check(error);
  return (data ?? []).length > 0;
}

// products.wish_count 증감 — supabase/wish_count.sql 의 RPC
export async function changeWishCount({ productId, delta }) {
  const { error } = await supabase.rpc('increment_wish_count', {
    p_product_id: productId,
    p_delta: delta,
  });
  check(error);
}
