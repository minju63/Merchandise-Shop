import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export const storeApi = {
  list: (params) => client.get('/stores', { params }),
  detail: (storeId) => client.get(`/stores/${storeId}`),
  products: (storeId, params) => client.get(`/stores/${storeId}/products`, { params }),
  guide: (storeId, type) =>
    client.get(
      `/stores/${storeId}/${{ hours: 'business-hours', pickup: 'pickup-info', delivery: 'delivery-info' }[type]}`
    ),
  reviews: (storeId, params) => client.get(`/stores/${storeId}/reviews`, { params }),
  reviewableItems: async (storeId) => client.get(`/stores/${storeId}/reviewable-items`, { headers: await authHeaders() }),
  writeReview: async (body) => client.post('/reviews', body, { headers: await authHeaders(), timeout: 60000 }),
};
