import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';

const KEYS = [
  'contentCategoryId',
  'goodsCategoryId',
  'sort',
  'minPrice',
  'maxPrice',
  'regionId',
  'inStock',
  'pickup',
  'delivery',
];

// Store results are derived from ALL matching listings, not just the current page.
// This does not implement the other team's store detail page.
export default function CategoryStoreResults({ queryKey, api, client, userId }) {
  const load = useCallback(
    async (signal) => {
      const query = new URLSearchParams(queryKey);
      if (query.has('goodsType') && !query.has('goodsCategoryId')) return [];
      const filters = Object.fromEntries(
        KEYS.filter((key) => query.has(key)).map((key) => [key, query.get(key)])
      );
      const stores = new Map();
      let processed = 0;
      for (let page = 1; ; page++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const result = await api.getProducts({ ...filters, page, size: 100, signal }, client);
        for (const product of result.items) {
          if (!stores.has(product.storeId))
            stores.set(product.storeId, { id: product.storeId, name: product.storeName, count: 0 });
          stores.get(product.storeId).count++;
        }
        processed += result.items.length;
        if (processed >= result.totalCount || result.items.length === 0) break;
      }
      return [...stores.values()];
    },
    [queryKey, api, client]
  );
  const request = useCategoryRequest(load, userId);
  return (
    <section className="category-store-results" aria-label="굿즈샵 검색 결과">
      <h2>굿즈샵{request.data ? ` · ${request.data.length}개` : ''}</h2>
      {request.loading ? (
        <p role="status">굿즈샵을 불러오는 중입니다.</p>
      ) : request.error ? (
        <ProductEmptyState message="굿즈샵을 불러오지 못했습니다." onRetry={request.retry} />
      ) : request.data.length === 0 ? (
        <ProductEmptyState message="조건에 맞는 굿즈샵이 없습니다." />
      ) : (
        <ul>
          {request.data.map((store) => (
            <li key={store.id}>
              <Link to={`/stores/${encodeURIComponent(store.id)}`}>
                <strong>{store.name}</strong>
                <span>조건에 맞는 상품 {store.count}개</span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
