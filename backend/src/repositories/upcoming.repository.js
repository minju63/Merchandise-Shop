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
  const db = getSupabase();
  const { data: existing, error: findError } = await db
    .from('open_alerts')
    .select('*')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .limit(1)
    .maybeSingle();

  throwOnError(findError);
  if (existing) return existing;

  const { data, error } = await db
    .from('open_alerts')
    .insert({ user_id: userId, product_id: productId })
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
