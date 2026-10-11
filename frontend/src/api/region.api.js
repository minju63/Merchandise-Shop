// 지역 API — 공유 Axios client를 사용한다.
export async function getRegions(client, signal) {
  const result = await client.get('/regions', { signal });
  const response = typeof result.success === 'boolean' ? result : result.data;
  if (!response.success) throw new Error(response.message || '지역을 불러오지 못했습니다.');
  return response.data;
}
