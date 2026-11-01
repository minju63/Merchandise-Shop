// 담당: 민주
// 출시 예정 상품의 오픈 알림 API
import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw Object.assign(new Error('로그인이 필요합니다.'), { status: 401 });
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export const openAlertApi = {
  list: async () => client.get('/users/me/open-alerts', { headers: await authHeaders() }),
  create: async (productId) =>
    client.post(`/products/${productId}/open-alert`, {}, { headers: await authHeaders() }),
  remove: async (productId) =>
    client.delete(`/products/${productId}/open-alert`, { headers: await authHeaders() }),
};
