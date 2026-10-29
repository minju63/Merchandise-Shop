// 담당: 동균
// 테이블: restock_alerts
// 활성 건에만 부분 UNIQUE (user_id, store_product_id) 가 걸려 있다.
// 해제는 행을 지우지 않고 is_active=false, 재신청은 비활성 행을 되살린다.
import { supabase } from '../lib/supabase.js';

const LIST_SELECT =
  'id,is_active,notified_at,created_at,store_product:store_products!inner(*,product:products!inner(*),store:stores!inner(*))';

function check(error) {
  if (error)
    throw Object.assign(new Error('재입고 알림 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'RESTOCK_ALERT_QUERY_FAILED',
    });
}

// 활성 알림이 걸린 store_product_id 목록 (in() 한 번으로 조회)
export async function findActiveStoreProductIds({ userId, storeProductIds }) {
  if (!storeProductIds.length) return [];
  const { data, error } = await supabase
    .from('restock_alerts')
    .select('store_product_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('store_product_id', storeProductIds);
  check(error);
  return (data ?? []).map((row) => row.store_product_id);
}

// 숨김·삭제 판매상품과 폐점·삭제 매장은 목록과 totalCount 양쪽에서 제외한다.
export async function findPageByUser({ userId, page, size }) {
  const offset = (page - 1) * size;
  const { data, count, error } = await supabase
    .from('restock_alerts')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('store_product.status', 'in', '(HIDDEN,DELETED)')
    .not('store_product.store.status', 'in', '(CLOSED,DELETED)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + size - 1);
  check(error);
  return { rows: data ?? [], totalCount: count ?? 0 };
}

// 활성 행이 있으면 그대로, 비활성 행이 있으면 가장 최근 것을 되살리고, 없을 때만 insert 한다.
// 동시 요청으로 부분 UNIQUE 에 걸리면(23505) 이미 활성화된 것이므로 성공으로 본다.
export async function activate({ userId, storeProductId }) {
  const { data: rows, error } = await supabase
    .from('restock_alerts')
    .select('id,is_active')
    .eq('user_id', userId)
    .eq('store_product_id', storeProductId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  check(error);
  const existing = rows?.[0];
  if (existing?.is_active) return;
  const { error: saveError } = existing
    ? await supabase
        .from('restock_alerts')
        .update({ is_active: true, notified_at: null })
        .eq('id', existing.id)
        .eq('user_id', userId)
    : await supabase
        .from('restock_alerts')
        .insert({ user_id: userId, store_product_id: storeProductId, is_active: true });
  if (saveError?.code === '23505') return;
  check(saveError);
}

// 찜 해제 · 알림 해제 시 활성 알림 취소 (행은 남긴다)
export async function deactivate({ userId, storeProductId }) {
  const { error } = await supabase
    .from('restock_alerts')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('store_product_id', storeProductId)
    .eq('is_active', true);
  check(error);
}
