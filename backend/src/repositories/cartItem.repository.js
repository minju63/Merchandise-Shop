// 담당: 동균
// 테이블: cart_items
import { supabase } from '../lib/supabase.js';

const LIST_SELECT =
  'id,store_product_id,fulfillment_type,quantity,is_selected,created_at,store_product:store_products!inner(*,product:products!inner(*),store:stores!inner(*))';

function check(error) {
  if (error)
    throw Object.assign(new Error('장바구니 조회에 실패했습니다.', { cause: error }), {
      status: 500,
      code: 'CART_ITEM_QUERY_FAILED',
    });
}

// 가격·재고는 저장하지 않으므로 조회할 때마다 store_products 를 조인해서 읽는다.
export async function findByUser({ userId, fulfillmentType }) {
  const { data, error } = await supabase
    .from('cart_items')
    .select(LIST_SELECT)
    .eq('user_id', userId)
    .eq('fulfillment_type', fulfillmentType)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true });
  check(error);
  return data ?? [];
}

export async function countByUser({ userId, fulfillmentType }) {
  let query = supabase.from('cart_items').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if (fulfillmentType) query = query.eq('fulfillment_type', fulfillmentType);
  const { count, error } = await query;
  check(error);
  return count ?? 0;
}

export async function findByKey({ userId, storeProductId, fulfillmentType }) {
  const { data, error } = await supabase
    .from('cart_items')
    .select('id,quantity')
    .eq('user_id', userId)
    .eq('store_product_id', storeProductId)
    .eq('fulfillment_type', fulfillmentType)
    .maybeSingle();
  check(error);
  return data;
}

// 수량 상한(max_per_order) 확인용으로 판매상품의 max_per_order 를 함께 읽는다.
export async function findById({ userId, cartItemId }) {
  const { data, error } = await supabase
    .from('cart_items')
    .select('id,quantity,is_selected,store_product:store_products!inner(max_per_order)')
    .eq('id', cartItemId)
    .eq('user_id', userId)
    .maybeSingle();
  check(error);
  return data;
}

// UNIQUE (user_id, store_product_id, fulfillment_type) 충돌이면 null — 동시에 담긴 경우
export async function insert({ userId, storeProductId, fulfillmentType, quantity }) {
  const { data, error } = await supabase
    .from('cart_items')
    .insert({
      user_id: userId,
      store_product_id: storeProductId,
      fulfillment_type: fulfillmentType,
      quantity,
      is_selected: true,
    })
    .select('id,quantity')
    .maybeSingle();
  if (error?.code === '23505') return null;
  check(error);
  return data;
}

export async function update({ userId, cartItemId, quantity, isSelected }) {
  const fields = { updated_at: new Date().toISOString() };
  if (quantity !== undefined) fields.quantity = quantity;
  if (isSelected !== undefined) fields.is_selected = isSelected;
  const { data, error } = await supabase
    .from('cart_items')
    .update(fields)
    .eq('id', cartItemId)
    .eq('user_id', userId)
    .select('id,quantity,is_selected')
    .maybeSingle();
  check(error);
  return data;
}

export async function unselect({ userId, cartItemIds }) {
  if (!cartItemIds.length) return;
  const { error } = await supabase
    .from('cart_items')
    .update({ is_selected: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', cartItemIds);
  check(error);
}

export async function removeByIds({ userId, cartItemIds }) {
  const { data, error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', userId)
    .in('id', cartItemIds)
    .select('id');
  check(error);
  return (data ?? []).length;
}
