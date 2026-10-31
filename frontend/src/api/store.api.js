import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function optionalAuthHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  return data.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}

export const storeApi = {
  list: (params) => client.get('/stores', { params }),
  detail: (storeId) => client.get(`/stores/${storeId}`),
  products: (storeId, params) => client.get(`/stores/${storeId}/products`, { params }),
  guide: (storeId, type) =>
    client.get(
      `/stores/${storeId}/${{ hours: 'business-hours', pickup: 'pickup-info', delivery: 'delivery-info' }[type]}`
    ),
  reviews: async (storeId, params) =>
    client.get(`/stores/${storeId}/reviews`, {
      params,
      headers: await optionalAuthHeaders(),
    }),
  reviewableItems: async (storeId) => client.get(`/stores/${storeId}/reviewable-items`, { headers: await authHeaders() }),
  writeReview: async (body) => client.post('/reviews', body, { headers: await authHeaders(), timeout: 60000 }),
  updateReview: async (reviewId, body) =>
    client.patch(`/reviews/${reviewId}`, body, {
      headers: await authHeaders(),
      timeout: 60000,
    }),
  deleteReview: async (reviewId) =>
    client.delete(`/reviews/${reviewId}`, { headers: await authHeaders() }),
  writeStoreReview: async (storeId, body) =>
    client.post(`/stores/${storeId}/reviews`, body, {
      headers: await authHeaders(),
      timeout: 60000,
    }),
  updateStoreReview: async (reviewId, body) =>
    client.patch(`/reviews/store/${reviewId}`, body, {
      headers: await authHeaders(),
      timeout: 60000,
    }),
  deleteStoreReview: async (reviewId) =>
    client.delete(`/reviews/store/${reviewId}`, { headers: await authHeaders() }),
};
