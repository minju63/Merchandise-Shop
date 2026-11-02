import { supabase } from '../lib/supabase.js';

// 내 문의는 로그인한 사람만 보고 쓰고 고칠 수 있어서 토큰을 붙여 보낸다.
async function authHeaders() {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

function unwrap(result, fallback) {
  const response = typeof result.success === 'boolean' ? result : result.data;
  if (!response.success) throw new Error(response.message || fallback);
  return response.data;
}

export async function getProductInquiries(
  storeProductId,
  { signal, page = 1, size = 10 } = {},
  client
) {
  if (!client) throw new Error('문의를 불러올 수 없습니다.');
  const result = await client.get(
    `/products/${encodeURIComponent(storeProductId)}/inquiries`,
    {
      params: { page, size },
      headers: await authHeaders(),
      signal,
    }
  );
  return unwrap(result, '문의 조회에 실패했습니다.');
}

export async function createProductInquiry(storeProductId, { content, title }, client) {
  if (!client) throw new Error('문의를 등록할 수 없습니다.');
  const result = await client.post(
    `/products/${encodeURIComponent(storeProductId)}/inquiries`,
    {
      content,
      ...(title ? { title } : {}),
    },
    { headers: await authHeaders() }
  );
  return unwrap(result, '문의 등록에 실패했습니다.');
}

export async function updateProductInquiry(storeProductId, inquiryId, { content, title }, client) {
  if (!client) throw new Error('문의를 수정할 수 없습니다.');
  const result = await client.patch(
    `/products/${encodeURIComponent(storeProductId)}/inquiries/${encodeURIComponent(inquiryId)}`,
    { content, title },
    { headers: await authHeaders() }
  );
  return unwrap(result, '문의 수정에 실패했습니다.');
}

export async function deleteProductInquiry(storeProductId, inquiryId, client) {
  if (!client) throw new Error('문의를 삭제할 수 없습니다.');
  const result = await client.delete(
    `/products/${encodeURIComponent(storeProductId)}/inquiries/${encodeURIComponent(inquiryId)}`,
    { headers: await authHeaders() }
  );
  return unwrap(result, '문의 삭제에 실패했습니다.');
}
