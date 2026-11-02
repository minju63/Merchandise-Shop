import client from './client.js';
import { supabase } from '../lib/supabase.js';

export async function listStoreInquiries(storeId, { page, signal }) {
  // Public reads remain available if auth storage is unavailable.
  let token;
  try {
    token = (await supabase?.auth.getSession())?.data.session?.access_token;
  } catch {
    /* Use public view. */
  }
  return client
    .get(`/stores/${encodeURIComponent(storeId)}/inquiries`, {
      params: { page, size: 10 },
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    .then((result) => result.data);
}

async function authHeaders() {
  if (!supabase) throw new Error('Supabase 인증 설정이 없습니다.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token || data.session.user?.is_anonymous) {
    throw Object.assign(new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.'), {
      status: 401,
    });
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}
export async function createStoreInquiry(storeId, body) {
  return client.post(`/stores/${encodeURIComponent(storeId)}/inquiries`, body, {
    headers: await authHeaders(),
  });
}
export async function updateStoreInquiry(storeId, inquiryId, body) {
  return client.patch(
    `/stores/${encodeURIComponent(storeId)}/inquiries/${encodeURIComponent(inquiryId)}`,
    body,
    { headers: await authHeaders() }
  );
}
export async function deleteStoreInquiry(storeId, inquiryId) {
  return client.delete(
    `/stores/${encodeURIComponent(storeId)}/inquiries/${encodeURIComponent(inquiryId)}`,
    { headers: await authHeaders() }
  );
}
