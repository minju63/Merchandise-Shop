import { getSupabase } from '../lib/supabase.js';

function throwOnError(error) {
  if (error) throw error;
}

export async function findUpcomingProducts({ now, endAt, limit }) {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .eq('status', 'UPCOMING')
    .gt('open_at', now)
    .lte('open_at', endAt)
    .order('open_at', { ascending: true })
    .order('alert_count', { ascending: false })
    .limit(limit);

  throwOnError(error);
  return data;
}

export async function findProductOpenState(productId) {
  const { data, error } = await getSupabase()
    .from('products')
    .select('id, status, open_at')
    .eq('id', productId)
    .maybeSingle();

  throwOnError(error);
  return data;
}

export async function createOpenAlert(userId, productId) {
  const { data, error } = await getSupabase()
    .from('open_alerts')
    .upsert(
      { user_id: userId, product_id: productId },
      { onConflict: 'user_id,product_id' }
    )
    .select()
    .single();

  throwOnError(error);
  return data;
}

export async function deleteOpenAlert(userId, productId) {
  const { error } = await getSupabase()
    .from('open_alerts')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);

  throwOnError(error);
}

export async function activateOpenedProducts(now) {
  const { data, error } = await getSupabase()
    .from('products')
    .update({ status: 'ON_SALE' })
    .eq('status', 'UPCOMING')
    .lte('open_at', now)
    .select('id');

  throwOnError(error);
  return data;
}
