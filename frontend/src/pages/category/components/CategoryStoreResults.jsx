import { useCallback } from 'react';
import SearchShopList from '../../search/SearchShopList.jsx';
import { searchApi } from '../../../api/search.api.js';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';
import { categoryFilterContext, categoryProductQuery } from './categoryProductFilters.js';

// Store results are derived from ALL matching listings, not just the current page.
// This does not implement the other team's store detail page.
export default function CategoryStoreResults({ queryKey, api, client, userId }) {
  const load = useCallback(
    async (signal) => {
      const query = new URLSearchParams(queryKey);
      if (categoryFilterContext(query).unavailableGoodsType) return [];
      const filters = categoryProductQuery(query, { includePage: false });
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
      // 굿즈샵 탭과 같은 카드를 쓰기 위해 매장 전체 정보를 가져와 합친다.
      const details = new Map((await searchApi.stores()).map((store) => [store.id, store]));
      return [...stores.values()].flatMap((store) => (details.has(store.id) ? [details.get(store.id)] : []));
    },
    [queryKey, api, client]
  );
  const request = useCategoryRequest(load, userId);
  return (
    <section className="category-store-section" aria-label="굿즈샵 검색 결과">
      {request.loading ? (
        <p role="status">굿즈샵을 불러오는 중입니다.</p>
      ) : request.error ? (
        <ProductEmptyState message="굿즈샵을 불러오지 못했습니다." onRetry={request.retry} />
      ) : request.data.length === 0 ? (
        <ProductEmptyState message="조건에 맞는 굿즈샵이 없습니다." />
      ) : (
        <SearchShopList shops={request.data} />
      )}
    </section>
  );
}
