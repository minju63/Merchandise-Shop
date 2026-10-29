// 담당: 동균
// 테이블: wishlist_shops
import { supabase } from '../lib/supabase.js';

function check(error) {
  if (error)
    throw Object.assign(new Error('찜한 굿즈샵 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'WISHLIST_SHOP_QUERY_FAILED',
    });
}

// 폐점·삭제 매장은 목록과 totalCount 양쪽에서 제외한다.
export async function findPageByUser({ userId, page, size }) {
  const offset = (page - 1) * size;
  const { data, count, error } = await supabase
    .from('wishlist_shops')
    .select('id,created_at,store:stores!inner(*)', { count: 'exact' })
    .eq('user_id', userId)
    .not('store.status', 'in', '(CLOSED,DELETED)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + size - 1);
  check(error);
  return { rows: data ?? [], totalCount: count ?? 0 };
}

export async function countByUser(userId) {
  const { count, error } = await supabase
    .from('wishlist_shops')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  check(error);
  return count ?? 0;
}

export async function insertIfAbsent({ userId, storeId }) {
  const { data, error } = await supabase
    .from('wishlist_shops')
    .upsert(
      { user_id: userId, store_id: storeId },
      { onConflict: 'user_id,store_id', ignoreDuplicates: true },
    )
    .select('id');
  check(error);
  return (data ?? []).length > 0;
}

export async function remove({ userId, storeId }) {
  const { data, error } = await supabase
    .from('wishlist_shops')
    .delete()
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .select('id');
  check(error);
  return (data ?? []).length > 0;
}
