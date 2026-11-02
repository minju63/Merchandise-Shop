// 팬 응원 전광판 API — client.js의 axios 인스턴스로 호출 (week · ranking 은 로그인 없이도 가능)
import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

// 로그인했으면 토큰을 붙이고, 아니면 공개 정보만 받는다.
async function optionalHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export const fanApi = {
  week: () => client.get('/fan/week'),
  ranking: async (params) => client.get('/fan/ranking', { params, headers: await optionalHeaders() }),
  me: async () => client.get('/fan/me', { headers: await authHeaders() }),
  results: async () => client.get('/fan/results', { headers: await authHeaders() }),
  tickets: async () => client.get('/fan/tickets', { headers: await authHeaders() }),
  characters: async (params) => client.get('/fan/characters', { params, headers: await authHeaders() }),
  anniversaryDates: async () => client.get('/fan/anniversary-dates', { headers: await authHeaders() }),
  buyWithCash: async (amount, paymentOption, paymentMethodId = null) =>
    client.post(
      '/fan/tickets/cash',
      { amount, paymentOption, paymentMethodId, paymentAgreed: true },
      { headers: await authHeaders() },
    ),
  buyWithCredit: async (quantity) => client.post('/fan/tickets/credit', { quantity }, { headers: await authHeaders() }),
  refundPack: async (packId, refundPaymentMethodId) =>
    client.post(`/fan/tickets/${packId}/refund`, { refundPaymentMethodId }, { headers: await authHeaders() }),
  design: async (designId) => client.get(`/fan/designs/${designId}`, { headers: await authHeaders() }),
  saveDesign: async (designId, body) => client.put(`/fan/designs/${designId}`, body, { headers: await authHeaders() }),
  submitDesign: async (designId) => client.post(`/fan/designs/${designId}/submit`, {}, { headers: await authHeaders() }),
  sendCheers: async (body) => client.post('/fan/cheers', body, { headers: await authHeaders() }),
  // 오늘 기념일인 최애 모아보기 (로그인 없이 볼 수 있고, 로그인하면 내 축하하기 표시가 함께 온다)
  day: async (date) => client.get(`/fan/day/${date}`, { headers: await optionalHeaders() }),
  toggleDayLike: async (date, characterId) =>
    client.post(`/fan/day/${date}/likes`, { characterId }, { headers: await authHeaders() }),
  addDayCongrats: async (date, characterId, message) =>
    client.post(`/fan/day/${date}/congrats`, { characterId, message }, { headers: await authHeaders() }),
  updateDayCongrats: async (date, congratsId, message) =>
    client.put(`/fan/day/${date}/congrats/${congratsId}`, { message }, { headers: await authHeaders() }),
  deleteDayCongrats: async (date, congratsId) =>
    client.delete(`/fan/day/${date}/congrats/${congratsId}`, { headers: await authHeaders() }),
};
