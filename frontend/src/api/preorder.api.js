// 담당: 동균
// 사전예약 API — client.js의 axios 인스턴스로 호출 (전부 로그인 필요 🔒)
import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export const preorderApi = {
  quote: async (params) => client.get('/preorders/quote', { params, headers: await authHeaders() }),
  create: async (body) => client.post('/preorders', body, { headers: await authHeaders() }),
  list: async (params) => client.get('/preorders', { params, headers: await authHeaders() }),
  remove: async (id) => client.delete(`/preorders/${id}`, { headers: await authHeaders() }),
};
