export async function getProductInquiries(
  storeProductId,
  { signal, page = 1, size = 10 } = {},
  client
) {
  if (!client) throw new Error('문의를 불러올 수 없습니다.');
  const { data: response } = await client.get(
    `/products/${encodeURIComponent(storeProductId)}/inquiries`,
    {
      params: { page, size },
      signal,
    }
  );
  if (!response.success) throw new Error(response.message || '문의 조회에 실패했습니다.');
  return response.data;
}

export async function createProductInquiry(storeProductId, { content, title }, client) {
  if (!client) throw new Error('문의를 등록할 수 없습니다.');
  const { data: response } = await client.post(
    `/products/${encodeURIComponent(storeProductId)}/inquiries`,
    {
      content,
      ...(title ? { title } : {}),
    }
  );
  if (!response.success) throw new Error(response.message || '문의 등록에 실패했습니다.');
  return response.data;
}
