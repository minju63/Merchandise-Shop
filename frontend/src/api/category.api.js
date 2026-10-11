// Inject the shared Axios client (baseURL: /api/v1). Never create a separate client here.
export async function getCategories({ type, contentCategoryId, signal } = {}, client) {
  if (!client) throw new Error('카테고리를 불러올 수 없습니다.');
  const { data: response } = await client.get('/categories', {
    params: { type, contentCategoryId },
    signal,
  });
  if (!response.success) throw new Error(response.message || '카테고리 조회에 실패했습니다.');
  return response.data;
}
