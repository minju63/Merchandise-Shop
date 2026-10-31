// 팬 응원 전광판 — 응원권 구매 · 응원 · 순위는 DB 함수(cheer_*)에서 처리한다.
// 테이블: fan_banner_weeks · cheers · cheer_ticket_packs · reward_credit_ledger · characters · anniversaries · payments
import { getSupabase } from '../lib/supabase.js';

function throwOnError(error) {
  if (error) throw error;
}

async function rpc(name, args) {
  const { data, error } = await getSupabase().rpc(name, args);
  throwOnError(error);
  return data;
}

export const currentWeek = () => rpc('ensure_fan_week', {});
export const balance = (userId) => rpc('cheer_balance', { p_user: userId });
export const ranking = ({ slot, date, userId, weekId }) => rpc('cheer_ranking', {
  p_slot: slot,
  p_date: date ?? null,
  p_user: userId ?? null,
  p_week: weekId ?? null,
});

export const resultFor = (userId) => rpc('fan_result_with_history', { p_user: userId });

export const designView = (userId, designId) => rpc('fan_get_design', { p_user: userId, p_design: designId });
export const saveDesign = (userId, designId, payload, backgroundPath, photoPath) => rpc('fan_save_design', {
  p_user: userId,
  p_design: designId,
  p_payload: payload,
  p_background: backgroundPath ?? null,
  p_photo: photoPath ?? null,
});
export const submitDesign = (userId, designId) => rpc('fan_submit_design', { p_user: userId, p_design: designId });
export const homeBoards = () => rpc('fan_home_boards', { p_date: null });

export async function signedUrl(path, seconds = 3600) {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from('fan-banner').createSignedUrl(path, seconds);
  throwOnError(error);
  return data.signedUrl;
}

export const buyWithCash = (userId, paymentId) => rpc('cheer_buy_with_cash', { p_user: userId, p_payment: paymentId });
export const buyWithCredit = (userId, quantity) => rpc('cheer_buy_with_credit', { p_user: userId, p_quantity: quantity });
export const refundPack = (userId, packId) => rpc('cheer_refund_pack', { p_user: userId, p_pack: packId });

export const send = (userId, input) => rpc('cheer_send', {
  p_user: userId,
  p_slot: input.slotType,
  p_character: input.characterId,
  p_anniversary: input.anniversaryId ?? null,
  p_message: input.message,
  p_nickname: input.nickname,
  p_count: input.count,
  p_agreed_rules: input.agreedRules === true,
  p_agreed_image_rights: input.agreedImageRights === true,
});

export async function insertChargePayment(userId, { amount, transactionId, methodLabel, approvedAt, isMock }) {
  const { data, error } = await getSupabase()
    .from('payments')
    .insert({
      user_id: userId,
      purpose: 'CHEER_CHARGE',
      method_label: methodLabel,
      amount,
      status: 'PAID',
      is_mock: isMock,
      pg_transaction_id: transactionId,
      approved_at: approvedAt,
    })
    .select('id')
    .single();
  throwOnError(error);
  return data.id;
}

export async function countWeekCheers(weekId) {
  const { data, error } = await getSupabase().from('cheers').select('cheer_count').eq('week_id', weekId);
  throwOnError(error);
  return data.reduce((sum, row) => sum + row.cheer_count, 0);
}

export async function findTicketPacks(userId) {
  const { data, error } = await getSupabase()
    .from('cheer_ticket_packs')
    .select('id, source, quantity, remaining, unit_price, status, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  throwOnError(error);
  return data;
}

export async function findCreditLedger(userId, limit = 30) {
  const { data, error } = await getSupabase()
    .from('reward_credit_ledger')
    .select('id, type, amount, expires_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  throwOnError(error);
  return data;
}

export async function findPayment(paymentId) {
  const { data, error } = await getSupabase()
    .from('payments')
    .select('id, pg_transaction_id, status')
    .eq('id', paymentId)
    .single();
  throwOnError(error);
  return data;
}

export async function markPaymentCanceled(paymentId) {
  const { error } = await getSupabase()
    .from('payments')
    .update({ status: 'CANCELED', canceled_at: new Date().toISOString() })
    .eq('id', paymentId);
  throwOnError(error);
}

// 다음 주(게시 기간)에 기념일이 있는 캐릭터와 기념일
export async function findAnniversaries({ from, to }) {
  const { data, error } = await getSupabase()
    .from('anniversaries')
    .select('id, kind, event_date, label, characters ( id, name, work_title, profile_image_url )')
    .eq('is_active', true)
    .gte('event_date', from)
    .lte('event_date', to)
    .order('event_date', { ascending: true });
  throwOnError(error);
  return data;
}

export async function searchCharacters(query) {
  let request = getSupabase()
    .from('characters')
    .select('id, name, work_title, profile_image_url')
    .order('name', { ascending: true })
    .limit(30);
  if (query) request = request.or(`name.ilike.%${query}%,work_title.ilike.%${query}%`);
  const { data, error } = await request;
  throwOnError(error);
  return data;
}
