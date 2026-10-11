import CategoryLayout from './components/CategoryLayout.jsx';
import CategoryProductCard from './components/CategoryProductCard.jsx';
import sharedClient from '../../api/client.js';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as productApi from '../../api/product.api';
import * as categoryApi from '../../api/category.api';
import * as regionApi from '../../api/region.api.js';
import ProductFilterBar from './components/ProductFilterBar';
import ProductFilterSheet from './components/ProductFilterSheet';
import ProductSort from './components/ProductSort';
import ProductEmptyState from './components/ProductEmptyState';
import useCategoryRequest from './components/useCategoryRequest';
import './components/category.css';
import './components/CategoryResultFilters.css';
import CategoryStoreResults from './components/CategoryStoreResults';
import {
  PRODUCT_FILTER_KEYS,
  categoryFilterContext,
  categoryProductQuery,
} from './components/categoryProductFilters.js';

const FILTER_KEYS = PRODUCT_FILTER_KEYS;
const EMPTY_CATEGORIES = [];
const EMPTY_REGIONS = [];

// ProductCard must be the shared component. regions are supplied by the shared region API.
function ProductListPageContent({
  client = sharedClient,
  ProductCard = CategoryProductCard,
  user,
  regions = EMPTY_REGIONS,
  categories = EMPTY_CATEGORIES,
  api = productApi,
}) {
  const [params, setParams] = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);
  const queryKey = params.toString();
  const loadCategories = useCallback(
    (signal) => categories.length ? categories : categoryApi.getCategories({ signal }, client),
    [categories, client]
  );
  const categoryRequest = useCategoryRequest(loadCategories);
  const availableCategories = categoryRequest.data ?? categories;
  const loadRegions = useCallback(
    (signal) => regions.length ? regions : regionApi.getRegions(client, signal),
    [regions, client]
  );
  const regionRequest = useCategoryRequest(loadRegions);
  const availableRegions = regionRequest.data ?? regions;
  const resultType = ['all', 'goods', 'stores'].includes(params.get('resultType'))
    ? params.get('resultType')
    : 'all';
  const contentCategoryId = params.get('contentCategoryId');
  const categoryReturnTo = contentCategoryId
    ? `/category?${new URLSearchParams({ contentCategoryId })}`
    : '/category';
  const load = useCallback(
    (signal) => {
      const query = new URLSearchParams(queryKey);
      // A planned type absent from the DB must not fall back to all products.
      if (categoryFilterContext(query).unavailableGoodsType) {
        return Promise.resolve({ items: [], page: 1, size: 20, totalCount: 0 });
      }
      const filters = categoryProductQuery(query);
      return api.getProducts({ ...filters, signal }, client);
    },
    [api, client, queryKey]
  );
  const request = useCategoryRequest(load, user?.id);
  const filters = Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) || '']));
  if (!filters.regionIds && filters.regionId) {
    filters.regionIds = filters.regionId;
    filters.regionId = '';
  }
  const selectedNames = ['contentCategoryId', 'goodsCategoryId']
    .map((key) =>
      key === 'contentCategoryId' && params.get('contentName')
        ? params.get('contentName')
        : key === 'goodsCategoryId' && params.get('allGoods') === 'true'
        ? '모두 보기'
        : key === 'goodsCategoryId' && params.get('goodsType')
        ? params.get('goodsType')
        : availableCategories.find((category) => category.id === params.get(key))?.name
    )
    .filter(Boolean);
  function update(values) {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('filterContentCategoryId');
      next.delete('filterGoodsCategoryId');
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
      {resultType !== 'goods' && (
        <CategoryStoreResults queryKey={queryKey} api={api} client={client} userId={user?.id} />
      )}
      {resultType !== 'stores' && <>
      <div className="category-section-heading">
        <p>
          {request.data ? `굿즈 ${request.data.totalCount.toLocaleString('ko-KR')}` : '상품 찾기'}
        </p>
        <ProductSort compact value={params.get('sort') || 'popular'} onChange={(sort) => update({ sort })} />
      </div>
      <ProductFilterBar
        filters={filters}
        regions={availableRegions}
        onChange={update}
        onOpen={() => setFilterOpen('price')}
        onReset={() => update(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))}
      />
      </>}
      {filterOpen && (
        <ProductFilterSheet
          filters={filters}
          regions={availableRegions}
          regionsLoading={regionRequest.loading}
          regionsError={regionRequest.error}
          onRetryRegions={regionRequest.retry}
          queryKey={queryKey}
          api={api}
          client={client}
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

    </main>
  );
}

export default function ProductListPage({ embedded = false, ...props }) {
  return <CategoryLayout embedded={embedded}><ProductListPageContent {...props} /></CategoryLayout>;
}
