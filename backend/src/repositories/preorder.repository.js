// 담당: 동균
// 테이블: preorders
// status: PENDING · RESERVED · CANCELED · EXPIRED (DB check 제약)
import { supabase } from '../lib/supabase.js';

const LIST_SELECT =
  '*,store_product:store_products!inner(*,product:products!inner(*),store:stores!inner(*))';
const ACTIVE_STATUSES = ['PENDING', 'RESERVED'];

function check(error) {
  if (error)
    throw Object.assign(new Error('사전예약 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'PREORDER_QUERY_FAILED',
    });
}

// 판매상품별 다음 순번 — supabase/preorder_priority.sql 의 RPC
export async function nextPriority(storeProductId) {
  const { data, error } = await supabase.rpc('next_preorder_priority', {
    p_store_product_id: storeProductId,
  });
  check(error);
  return data;
}

export async function findActive({ userId, storeProductId }) {
  const { data, error } = await supabase
    .from('preorders')
    .select('id')
    .eq('user_id', userId)
    .eq('store_product_id', storeProductId)
    .in('status', ACTIVE_STATUSES)
    .limit(1);
  check(error);
  return data?.[0] ?? null;
}

export async function insert({
  userId,
  storeProductId,
  quantity,
  unitPrice,
  depositRate,
  depositAmount,
  balanceAmount,
  priority,
}) {
  const { data, error } = await supabase
    .from('preorders')
    .insert({
      user_id: userId,
      store_product_id: storeProductId,
      quantity,
      unit_price: unitPrice,
      deposit_rate: depositRate,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      priority,
      status: 'RESERVED',
    })
    .select('id,priority,deposit_amount,balance_amount')
    .single();
  check(error);
  return data;
}

export async function findPageByUser({ userId, page, size }) {
  const offset = (page - 1) * size;
  const { data, count, error } = await supabase
    .from('preorders')
    .select(LIST_SELECT, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + size - 1);
  check(error);
  return { rows: data ?? [], totalCount: count ?? 0 };
}

export async function findById({ userId, preorderId }) {
  const { data, error } = await supabase
    .from('preorders')
    .select('id,status')
    .eq('id', preorderId)
    .eq('user_id', userId)
    .maybeSingle();
  check(error);
  return data;
}

// 행은 지우지 않고 상태만 CANCELED 로 바꾼다.
export async function cancel({ userId, preorderId }) {
  const { error } = await supabase
    .from('preorders')
    .update({ status: 'CANCELED', updated_at: new Date().toISOString() })
    .eq('id', preorderId)
    .eq('user_id', userId)
    .in('status', ACTIVE_STATUSES);
  check(error);
}
