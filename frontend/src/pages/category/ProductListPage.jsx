import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as productApi from '../../api/product.api';
import ProductFilterBar from './components/ProductFilterBar';
import ProductFilterSheet from './components/ProductFilterSheet';
import ProductSort from './components/ProductSort';
import ProductEmptyState from './components/ProductEmptyState';
import useCategoryRequest from './components/useCategoryRequest';
import './components/category.css';
import CategoryStoreResults from './components/CategoryStoreResults';

const FILTER_KEYS = ['minPrice', 'maxPrice', 'regionId', 'inStock', 'pickup', 'delivery'];
const QUERY_KEYS = ['contentCategoryId', 'goodsCategoryId', 'sort', 'page', 'size', ...FILTER_KEYS];

// ProductCard must be the shared component. regions are supplied by the shared region API.
export default function ProductListPage({
  client,
  ProductCard,
  user,
  regions = [],
  categories = [],
  api = productApi,
}) {
  const [params, setParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const queryKey = params.toString();
  const resultType = ['all', 'goods', 'stores'].includes(params.get('resultType'))
    ? params.get('resultType')
    : 'goods';
  const contentCategoryId = params.get('contentCategoryId');
  const categoryReturnTo = contentCategoryId
    ? `/category?${new URLSearchParams({ contentCategoryId })}`
    : '/category';
  const load = useCallback(
    (signal) => {
      const query = new URLSearchParams(queryKey);
      // A planned type absent from the DB must not fall back to all products.
      if (query.has('goodsType') && !query.has('goodsCategoryId')) {
        return Promise.resolve({ items: [], page: 1, size: 20, totalCount: 0 });
      }
      const filters = Object.fromEntries(
        QUERY_KEYS.filter((key) => query.has(key)).map((key) => [key, query.get(key)])
      );
      return api.getProducts({ ...filters, signal }, client);
    },
    [api, client, queryKey]
  );
  const request = useCategoryRequest(load, user?.id);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || '']));
  const selectedNames = ['contentCategoryId', 'goodsCategoryId']
    .map((key) =>
      key === 'goodsCategoryId' && params.get('goodsType')
        ? params.get('goodsType')
        : categories.find((category) => category.id === params.get(key))?.name
    )
    .filter(Boolean);
  function update(values) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(values)) {
        if (value === '' || value === undefined) next.delete(key);
        else next.set(key, String(value));
      }
      if (!Object.hasOwn(values, 'page')) next.set('page', '1');
      return next;
    });
  }
  const page = request.data?.page || Number(params.get('page')) || 1;
  const size = request.data?.size || 20;
  return (
    <main className="category-page">
      <Link to={categoryReturnTo}>← 카테고리</Link>
      <h1 className="category-list-title">{selectedNames.join(' > ') || '상품 목록'}</h1>
      <nav className="category-result-tabs" aria-label="결과 유형">
        {[
          ['all', '전체'],
          ['goods', '굿즈'],
          ['stores', '굿즈샵'],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={resultType === value}
            onClick={() => update({ resultType: value })}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="category-section-heading">
        <p>
          {request.data ? `${request.data.totalCount.toLocaleString('ko-KR')}개 상품` : '상품 찾기'}
        </p>
      </div>
      <ProductFilterBar
        filters={filters}
        regions={regions}
        onOpen={(section) => setFilterOpen(section)}
        onReset={() => update(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))}
      >
        <ProductSort
          compact
          value={params.get('sort') || 'popular'}
          onChange={(sort) => update({ sort })}
        />
      </ProductFilterBar>
      {filterOpen && (
        <ProductFilterSheet
          filters={filters}
          regions={regions}
          initialSection={filterOpen}
          onClose={() => setFilterOpen(false)}
          onApply={(draft) => {
            update(draft);
            setFilterOpen(false);
          }}
        />
      )}
      {resultType !== 'stores' &&
        (request.loading ? (
          <p role="status">상품을 불러오는 중입니다.</p>
        ) : request.error ? (
          <ProductEmptyState
            message="상품을 불러오지 못했습니다. 필터 조건을 확인하거나 다시 시도해 주세요."
            onRetry={request.retry}
          />
        ) : !request.data?.items.length ? (
          <ProductEmptyState />
        ) : !ProductCard ? (
          <ProductEmptyState message="상품 목록을 표시할 수 없습니다." />
        ) : (
          <div className="category-product-grid">
            {request.data.items.map((product) => (
              <Link
                key={product.storeProductId}
                to={`/products/${encodeURIComponent(product.storeProductId)}`}
                state={{ listReturnTo: `/category/products${queryKey ? `?${queryKey}` : ''}` }}
              >
                <ProductCard product={product} />
              </Link>
            ))}
          </div>
        ))}
      {resultType !== 'stores' && request.data?.totalCount > 0 && (
        <nav className="category-pagination" aria-label="상품 페이지">
          <button
            type="button"
            disabled={request.loading || page <= 1}
            onClick={() => update({ page: page - 1 })}
          >
            이전
          </button>
          <span>
            {page} / {Math.ceil(request.data.totalCount / size)}
          </span>
          <button
            type="button"
            disabled={request.loading || page * size >= request.data.totalCount}
            onClick={() => update({ page: page + 1 })}
          >
            다음
          </button>
        </nav>
      )}
      {resultType !== 'goods' && (
        <CategoryStoreResults queryKey={queryKey} api={api} client={client} userId={user?.id} />
      )}
    </main>
  );
}
