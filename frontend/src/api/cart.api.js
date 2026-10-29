// 담당: 동균
// 장바구니 API — client.js의 axios 인스턴스로 호출 (전부 로그인 필요 🔒)
import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export const cartApi = {
  list: async (type) => client.get('/cart', { params: { type }, headers: await authHeaders() }),
  counts: async () => client.get('/cart/counts', { headers: await authHeaders() }),
  addItem: async (body) => client.post('/cart/items', body, { headers: await authHeaders() }),
  updateItem: async (id, body) => client.patch(`/cart/items/${id}`, body, { headers: await authHeaders() }),
  removeItems: async (ids) => client.delete('/cart/items', { data: { ids }, headers: await authHeaders() }),
};
