import { supabase } from '../lib/supabase.js';
// Inject the shared Axios client; authentication/interceptors remain shared responsibilities.
async function authHeaders(required = false) {
  if (!supabase) {
    if (required) throw new Error('Sign in to like a review.');
    return {};
  }
  const { data } = await supabase.auth.getSession();
  if (required && !data.session?.access_token) throw new Error('Sign in to like a review.');
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function get(path, params, signal, client, headers = {}) {
  if (!client) throw new Error('상품을 불러올 수 없습니다.');
  const result = await client.get(path, { params, signal, headers });
  const response = typeof result.success === 'boolean' ? result : result.data;
  if (!response.success) throw new Error(response.message || '상품 조회에 실패했습니다.');
  return response.data;
}

export function getProducts({ signal, ...filters } = {}, client) {
  return get('/products', filters, signal, client);
}

export function getProductDetail(storeProductId, { signal } = {}, client) {
  return get(`/products/${encodeURIComponent(storeProductId)}`, undefined, signal, client);
}

export async function getProductReviews(storeProductId, { signal, sort = 'latest', page = 1, size = 20, mineOnly = false } = {}, client) {
  return get(
    `/products/${encodeURIComponent(storeProductId)}/reviews`,
    { sort, page, size, mineOnly },
    signal,
    client,
    await authHeaders()
  );
}

export async function toggleProductReviewLike(reviewId, liked, client) {
  if (!client) throw new Error('Review actions are unavailable.');
  const headers = await authHeaders(true);
  const result = liked
    ? await client.put(`/reviews/${encodeURIComponent(reviewId)}/like`, {}, { headers })
    : await client.delete(`/reviews/${encodeURIComponent(reviewId)}/like`, { headers });
  const response = typeof result.success === 'boolean' ? result : result.data;
  if (!response.success) throw new Error(response.message || 'Could not update review like.');
  return response.data;
}

export function getRelatedProducts(storeProductId, { signal, size = 8 } = {}, client) {
  return get(`/products/${encodeURIComponent(storeProductId)}/related`, { size }, signal, client);
}

export function getSimilarStores(storeProductId, { signal, size = 10, includeCurrent } = {}, client) {
  return get(
    `/products/${encodeURIComponent(storeProductId)}/similar-stores`,
    { size, includeCurrent },
    signal,
    client
  );
}
