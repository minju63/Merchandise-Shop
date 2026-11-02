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
  map: (params) => client.get('/stores/map', { params }),
  productStores: (productId, params) => client.get(`/products/${productId}/stores`, { params }),
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
  toggleStoreReviewLike: async (reviewId, liked) => {
    const headers = await authHeaders();
    const response = liked
      ? await client.put(`/reviews/store/${encodeURIComponent(reviewId)}/like`, {}, { headers })
      : await client.delete(`/reviews/store/${encodeURIComponent(reviewId)}/like`, { headers });
    if (!response.success) throw new Error(response.message || '좋아요를 처리하지 못했습니다.');
    return response.data;
  },
  toggleProductReviewLike: async (reviewId, liked) => {
    const headers = await authHeaders();
    const response = liked
      ? await client.put(`/reviews/${encodeURIComponent(reviewId)}/like`, {}, { headers })
      : await client.delete(`/reviews/${encodeURIComponent(reviewId)}/like`, { headers });
    if (!response.success) throw new Error(response.message || '좋아요를 처리하지 못했습니다.');
    return response.data;
  },
};
