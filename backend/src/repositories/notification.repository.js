// 알림 목록 · 읽음 처리 · 30일 보관 정책
import { getSupabase } from '../lib/supabase.js';

const COLUMNS = 'id,type,title,body,target_type,target_id,is_read,created_at';

function throwOnError(error) {
  if (!error) return;
  throw Object.assign(new Error('알림을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.', { cause: error }), {
    status: 503,
    code: 'NOTIFICATION_DATABASE_ERROR',
    databaseCode: error.code,
  });
}

export async function listForUser(userId, limit = 100) {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);
  throwOnError(error);
  return data ?? [];
}

export async function markAllRead(userId) {
  const { data, error } = await getSupabase()
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('id');
  throwOnError(error);
  return data?.length ?? 0;
}

export async function markRead(userId, notificationId) {
  const { data, error } = await getSupabase()
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('id', notificationId)
    .select('id')
    .maybeSingle();
  throwOnError(error);
  return data;
}

export async function deleteExpired(before, userId = null) {
  let query = getSupabase().from('notifications').delete().lt('created_at', before);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.select('id');
  throwOnError(error);
  return data?.length ?? 0;
}

async function exactCount(query) {
  const { count, error } = await query;
  throwOnError(error);
  return Number.isSafeInteger(count) ? count : 0;
}

export const countUnread = (userId) => exactCount(
  getSupabase()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
);

export const countCartItems = (userId) => exactCount(
  getSupabase().from('cart_items').select('id', { count: 'exact', head: true }).eq('user_id', userId)
);
