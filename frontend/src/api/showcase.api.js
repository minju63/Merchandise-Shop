import client from './client.js';
import { supabase } from '../lib/supabase.js';

async function headers(required = false) {
  if (!supabase) {
    if (required) throw new Error('로그인이 필요합니다.');
    return {};
  }
  const { data } = await supabase.auth.getSession();
  if (required && !data.session?.access_token) throw new Error('로그인이 필요합니다.');
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}
export const showcaseApi = {
  list: async (params) => client.get('/showcases', { params, headers: await headers() }).then((r) => r.data),
  mine: async (params) => client.get('/showcases/mine', { params, headers: await headers(true) }).then((r) => r.data),
  detail: async (id) => client.get(`/showcases/${id}`, { headers: await headers() }).then((r) => r.data),
  backgrounds: async () => client.get('/showcases/backgrounds').then((r) => r.data),
  categories: async () => client.get('/showcases/categories').then((r) => r.data),
  products: async (storeId) => client.get(`/showcases/stores/${storeId}/products`, { headers: await headers(true) }).then((r) => r.data),
  create: async (body) => client.post('/showcases', body, { headers: await headers(true) }).then((r) => r.data),
  save: async (id, body) => client.put(`/showcases/${id}`, body, { headers: await headers(true) }).then((r) => r.data),
  remove: async (id) => client.delete(`/showcases/${id}`, { headers: await headers(true) }),
  like: async (id, liked) => (liked
    ? client.put(`/showcases/${id}/like`, {}, { headers: await headers(true) })
    : client.delete(`/showcases/${id}/like`, { headers: await headers(true) })).then((r) => r.data),
  upload: async (id, kind, file) => {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
      reader.readAsDataURL(file);
    });
    return client.post(`/showcases/${id}/images`, { kind, base64 }, { headers: await headers(true), timeout: 30000 }).then((r) => r.data);
  },
  removeBackground: async (id, path) => client.post(`/showcases/${id}/remove-background`, { path }, { headers: await headers(true), timeout: 45000 }).then((r) => r.data),
  removeProductBackground: async (id, productId) => client.post(`/showcases/${id}/products/${productId}/remove-background`, {}, { headers: await headers(true), timeout: 45000 }).then((r) => r.data),
  image: async (url) => {
    const response = await client.get(url.replace(/^\/api\/v1/, ''), { headers: await headers(), responseType: 'blob' });
    return response;
  },
};
