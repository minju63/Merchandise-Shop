// 담당: 동균
// 테이블: restock_alerts
import { supabase } from '../lib/supabase.js';

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

// 찜 해제 시 연결된 재입고 알림 취소
export async function deactivate({ userId, storeProductId }) {
  const { error } = await supabase
    .from('restock_alerts')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('store_product_id', storeProductId)
    .eq('is_active', true);
  check(error);
}
