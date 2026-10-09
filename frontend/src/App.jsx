import {
  Navigate,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import HomePage from './pages/home/HomePage.jsx';
import { homeMockData, homeMockUserState } from './pages/home/homeMockData.js';
import SearchPage, { SearchResultsPage } from './pages/search/SearchPage.jsx';
import { parseRegionalQuery } from './pages/search/searchQuery.js';
import { searchMockData } from './pages/search/searchMockData.js';
import StoreListPage from './pages/stores/StoreListPage.jsx';
import StoreDetailPage from './pages/stores/StoreDetailPage.jsx';
import StoreReviewPage from './pages/stores/StoreReviewPage.jsx';
import StoreReviewWritePage from './pages/stores/StoreReviewWritePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { storeApi } from './api/store.api.js';
import { searchApi } from './api/search.api.js';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
const EMPTY_STORES = [];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function logSearch(payload) {
  fetch(`${API_BASE_URL}/search/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    // 검색 API 없이 실행하는 로컬 목업 화면도 계속 사용할 수 있다.
  });
}

function searchUrl(path, { query, storeId, sort, page, regionAll } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (storeId) params.set('storeId', storeId);
  if (sort && sort !== 'popular') params.set('sort', sort);
  if (page && page !== 1) params.set('page', String(page));
  if (regionAll) params.set('region', 'all');
  return `${path}${params.size ? `?${params}` : ''}`;
}

function useStoreFilter(storeId) {
  return useQuery({
    queryKey: ['store', storeId],
    queryFn: () => storeApi.detail(storeId),
    enabled: Boolean(storeId),
    retry: false,
  });
}

function HomeRoute() {
  const navigate = useNavigate();
  return (
    <HomePage
      data={homeMockData}
      {...homeMockUserState}
      onSearch={() => navigate('/search')}
      onStores={() => navigate('/stores')}
    />
  );
}

function SearchRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('storeId');
  const storeQuery = useStoreFilter(storeId);
  const shopsQuery = useQuery({
    queryKey: ['search-stores'],
    queryFn: searchApi.stores,
    enabled: !storeId,
    staleTime: 60000,
    retry: false,
  });
  return (
    <SearchPage
      data={searchMockData}
      shops={shopsQuery.data ?? EMPTY_STORES}
      storeId={storeId}
      storeName={storeQuery.data?.data.name}
      storeError={storeQuery.error?.message}
      onClearStore={() => navigate('/search')}
      onBack={() => navigate(storeId ? `/stores/${storeId}` : '/')}
      onSearch={(query) => navigate(searchUrl('/search/results', { query, storeId }))}
      onHome={() => navigate('/')}
      onStores={() => navigate('/stores')}
    />
  );
}

function SearchResultsRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const storeId = searchParams.get('storeId');
  const sort = searchParams.get('sort') ?? 'popular';
  const page = Number(searchParams.get('page') ?? 1);
  const regionAll = searchParams.get('region') === 'all';
  const parsedQuery = parseRegionalQuery(query, searchMockData);
  const region = !storeId && !regionAll ? parsedQuery.region?.label : undefined;
  const keyword = storeId ? query : parsedQuery.keyword;
  const storeQuery = useStoreFilter(storeId);
  const productsQuery = useQuery({
    queryKey: ['search-products', storeId, keyword, region, sort, page],
    queryFn: () => searchApi.products({ storeId: storeId || undefined, q: keyword, region, sort, page, size: 20 }),
    enabled: Boolean(query || storeId),
    retry: false,
  });
  const needsNationwideFallback = Boolean(!storeId && region && keyword && productsQuery.data?.data.totalCount === 0);
  const nationwideQuery = useQuery({
    queryKey: ['search-products', null, keyword, null, sort, page],
    queryFn: () => searchApi.products({ q: keyword, sort, page, size: 20 }),
    enabled: needsNationwideFallback,
    retry: false,
  });
  const shopsQuery = useQuery({
    queryKey: ['search-stores'],
    queryFn: searchApi.stores,
    enabled: Boolean(query && !storeId),
    staleTime: 60000,
    retry: false,
  });

  if (!query && !storeId) return <Navigate to="/search" replace />;

  return (
    <SearchResultsPage
      key={`${query}:${storeId ?? ''}`}
      initialQuery={query}
      data={searchMockData}
      products={(needsNationwideFallback ? nationwideQuery.data : productsQuery.data)?.data.items ?? []}
      productTotalCount={(needsNationwideFallback ? nationwideQuery.data : productsQuery.data)?.data.totalCount ?? 0}
      shops={shopsQuery.data ?? EMPTY_STORES}
      storeId={storeId}
      storeName={storeQuery.data?.data.name}
      storeError={storeQuery.error?.message || productsQuery.error?.message}
      scopedLoading={Boolean(storeId && (storeQuery.isPending || productsQuery.isPending))}
      scopedTotalCount={productsQuery.data?.data.totalCount ?? 0}
      globalLoading={Boolean(!storeId && (productsQuery.isPending || shopsQuery.isPending || (needsNationwideFallback && nationwideQuery.isPending)))}
      globalError={!storeId ? productsQuery.error?.message || nationwideQuery.error?.message || shopsQuery.error?.message : null}
      regionEnabled={!regionAll}
      useNationwideFallback={needsNationwideFallback}
      sort={sort}
      page={page}
      onRetry={() => { if (storeId) storeQuery.refetch(); productsQuery.refetch(); if (needsNationwideFallback) nationwideQuery.refetch(); if (!storeId) shopsQuery.refetch(); }}
      onClearStore={(currentQuery) => navigate(searchUrl(currentQuery.trim() ? '/search/results' : '/search', { query: currentQuery.trim(), sort, regionAll }))}
      onSortChange={(nextSort) => navigate(searchUrl('/search/results', { query, storeId, sort: nextSort, regionAll }))}
      onPageChange={(nextPage) => navigate(searchUrl('/search/results', { query, storeId, sort, page: nextPage, regionAll }))}
      onDisableRegion={() => navigate(searchUrl('/search/results', { query, storeId, sort, regionAll: true }))}
      onBack={() => navigate(searchUrl('/search', { storeId }))}
      onSearch={(nextQuery) => navigate(searchUrl('/search/results', { query: nextQuery, storeId, sort }))}
      onLogSearch={logSearch}
      onHome={() => navigate('/')}
      onStores={() => navigate('/stores')}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/search" element={<SearchRoute />} />
        <Route path="/search/results" element={<SearchResultsRoute />} />
        <Route path="/stores" element={<StoreListPage />} />
        <Route path="/stores/:storeId" element={<StoreDetailPage />} />
        <Route path="/stores/:storeId/reviews" element={<StoreReviewPage />} />
        <Route path="/stores/:storeId/reviews/write" element={<StoreReviewWritePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
