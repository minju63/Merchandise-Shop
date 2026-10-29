// Inject the shared Axios client; authentication/interceptors remain shared responsibilities.
async function get(path, params, signal, client) {
  if (!client) throw new Error('상품을 불러올 수 없습니다.');
  const result = await client.get(path, { params, signal });
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
