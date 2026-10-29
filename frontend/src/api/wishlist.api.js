// 담당: 동균
// 찜 API — client.js의 axios 인스턴스로 호출 (전부 로그인 필요 🔒)
import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  if (!data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}

// 세션이 없어 authHeaders()가 막은 경우와 서버가 401을 준 경우를 같이 본다
export const isAuthError = (error) =>
  error?.status === 401 || error?.message === '로그인이 필요합니다.';

export const wishlistApi = {
  products: async (params) => client.get('/wishlist/products', { params, headers: await authHeaders() }),
  shops: async (params) => client.get('/wishlist/shops', { params, headers: await authHeaders() }),
  counts: async () => client.get('/wishlist/counts', { headers: await authHeaders() }),
  addProduct: async (storeProductId) =>
    client.post('/wishlist/products', { storeProductId }, { headers: await authHeaders() }),
  removeProduct: async (storeProductId) =>
    client.delete(`/wishlist/products/${storeProductId}`, { headers: await authHeaders() }),
  addShop: async (storeId) => client.post('/wishlist/shops', { storeId }, { headers: await authHeaders() }),
  removeShop: async (storeId) => client.delete(`/wishlist/shops/${storeId}`, { headers: await authHeaders() }),
  // 재입고 알림 — 매장 단위(storeProductId). 상품 단위 오픈 알림과는 다른 기능이다.
  restockAlerts: {
    list: async (params) => client.get('/restock-alerts', { params, headers: await authHeaders() }),
    create: async (storeProductId) =>
      client.post('/restock-alerts', { storeProductId }, { headers: await authHeaders() }),
    remove: async (storeProductId) =>
      client.delete(`/restock-alerts/${storeProductId}`, { headers: await authHeaders() }),
  },
};
