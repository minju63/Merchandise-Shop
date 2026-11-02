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

// 그날 기념일인 최애 모아보기 · 축하하기 · 축하 한마디
export const dayBoard = (date, userId) => rpc('fan_day_board', { p_date: date, p_user: userId ?? null });
export const dayLikeToggle = (userId, date, characterId) => rpc('fan_day_like_toggle', {
  p_user: userId,
  p_date: date,
  p_character: characterId,
});
export const dayCongratsAdd = (userId, date, characterId, message) => rpc('fan_day_congrats_add', {
  p_user: userId,
  p_date: date,
  p_character: characterId,
  p_message: message,
});
export const dayCongratsUpdate = (userId, date, congratsId, message) => rpc('fan_day_congrats_update', {
  p_user: userId,
  p_date: date,
  p_congrats: congratsId,
  p_message: message,
});
export const dayCongratsDelete = (userId, date, congratsId) => rpc('fan_day_congrats_delete', {
  p_user: userId,
  p_date: date,
  p_congrats: congratsId,
});

// 홈 배너 칩에 쓰는 "그날 기념일인 최애" 종류 목록
export async function findDayAnniversaryKinds(date) {
  const { data, error } = await getSupabase()
    .from('anniversaries')
    .select('kind')
    .eq('event_date', date)
    .eq('is_active', true);
  throwOnError(error);
  return (data ?? []).map((row) => row.kind);
}

export async function signedUrl(path, seconds = 3600) {
  if (!path) return null;
  const { data, error } = await getSupabase().storage.from('fan-banner').createSignedUrl(path, seconds);
  throwOnError(error);
  return data.signedUrl;
}

export const buyWithCash = (userId, paymentId) => rpc('cheer_buy_with_cash', { p_user: userId, p_payment: paymentId });
export const buyWithCredit = (userId, quantity) => rpc('cheer_buy_with_credit', { p_user: userId, p_quantity: quantity });
export const refundPack = (userId, packId, quantity) => rpc('cheer_refund_pack', { p_user: userId, p_pack: packId, p_quantity: quantity });

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

export async function insertChargePayment(userId, { amount, transactionId, methodLabel, approvedAt, isMock, paymentMethodId = null, purpose = 'CHEER_CHARGE' }) {
  const { data, error } = await getSupabase()
    .from('payments')
    .insert({
      user_id: userId,
      purpose,
      payment_method_id: paymentMethodId,
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
    .select('id, source, quantity, remaining, unit_price, status, expires_at, created_at, payment:payments ( method_label )')
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
    .select('id, pg_transaction_id, status, method_label')
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

// ── 유료 전광판 게시 (날짜별 판매)
export const billboardBook = (userId, characterId, dates, paymentId, price) => rpc('fan_billboard_book', {
  p_user: userId, p_character: characterId, p_dates: dates, p_payment: paymentId, p_price: price,
});

// 기간 안에서 살 수 없는 날짜: 기념일이 있는 날, 이미 팔린 날, 예전 방식으로 확정된 게시일
export async function findBillboardBlocked({ from, to }) {
  const db = getSupabase();
  const [anniversaries, sold, slots] = await Promise.all([
    db.from('anniversaries').select('event_date, label').eq('is_active', true).gte('event_date', from).lte('event_date', to),
    db.from('fan_billboard_days').select('day').gte('day', from).lte('day', to),
    db.from('fan_banner_slots').select('publish_date, publish_days').eq('slot_type', 'FREE').in('status', ['DECIDED', 'PUBLISHED']).lte('publish_date', to),
  ]);
  [anniversaries, sold, slots].forEach((result) => throwOnError(result.error));
  return { anniversaries: anniversaries.data, sold: sold.data, slots: slots.data };
}

// 내가 산 게시: 구간마다 꾸미기(디자인) 한 건
export async function findMyBillboards(userId) {
  const db = getSupabase();
  const { data: bookings, error } = await db.from('fan_billboard_bookings').select('id').eq('user_id', userId).eq('status', 'PAID');
  throwOnError(error);
  if (!bookings.length) return [];
  const { data: days, error: dayError } = await db.from('fan_billboard_days').select('slot_id').in('booking_id', bookings.map((row) => row.id));
  throwOnError(dayError);
  const { data, error: designError } = await db
    .from('fan_banner_designs')
    .select('id, review_status, due_at, slot:fan_banner_slots!inner ( publish_date, publish_days, character:characters!winner_character_id ( name ) )')
    .eq('user_id', userId)
    .in('slot_id', [...new Set(days.map((row) => row.slot_id))]);
  throwOnError(designError);
  return data;
}
