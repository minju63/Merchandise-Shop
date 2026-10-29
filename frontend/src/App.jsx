import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import HomePage from './pages/home/HomePage.jsx';
import { homeMockData, homeMockUserState } from './pages/home/homeMockData.js';
import SearchPage, { SearchResultsPage } from './pages/search/SearchPage.jsx';
import { parseRegionalQuery } from './pages/search/searchQuery.js';
import { searchMockData } from './pages/search/searchMockData.js';
import { EMPTY_FILTERS, filterParams } from './pages/search/searchFilters.js';
import StoreListPage from './pages/stores/StoreListPage.jsx';
import StoreDetailPage from './pages/stores/StoreDetailPage.jsx';
import StoreReviewPage from './pages/stores/StoreReviewPage.jsx';
import StoreReviewWritePage from './pages/stores/StoreReviewWritePage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import SignupTermsPage from './pages/auth/SignupTermsPage.jsx';
import SignupInfoPage from './pages/auth/SignupInfoPage.jsx';
import SignupDonePage from './pages/auth/SignupDonePage.jsx';
import FindPasswordPage from './pages/auth/FindPasswordPage.jsx';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx';
import CheckoutPage from './pages/common/CheckoutPage.jsx';
import OrderCompletePage from './pages/common/OrderCompletePage.jsx';
import MyPage from './pages/my/MyPage.jsx';
import OrdersPage from './pages/my/OrdersPage.jsx';
import OrderDetailPage from './pages/my/OrderDetailPage.jsx';
import ReviewWritePage from './pages/my/ReviewWritePage.jsx';
import MembershipPage from './pages/my/MembershipPage.jsx';
import CouponsPage from './pages/my/CouponsPage.jsx';
import CouponDetailPage from './pages/my/CouponDetailPage.jsx';
import AddressesPage from './pages/my/AddressesPage.jsx';
import AddressFormPage from './pages/my/AddressFormPage.jsx';
import PaymentMethodsPage from './pages/my/PaymentMethodsPage.jsx';
import NotificationSettingsPage from './pages/my/NotificationSettingsPage.jsx';
import ProfilePage from './pages/my/ProfilePage.jsx';
import SupportPage from './pages/my/SupportPage.jsx';
import NoticeListPage from './pages/my/NoticeListPage.jsx';
import NoticeDetailPage from './pages/my/NoticeDetailPage.jsx';
import InquiryListPage from './pages/my/InquiryListPage.jsx';
import InquiryFormPage from './pages/my/InquiryFormPage.jsx';
import ReportListPage from './pages/my/ReportListPage.jsx';
import TermsPage from './pages/my/TermsPage.jsx';
import TermsBodyPage from './pages/my/TermsBodyPage.jsx';
import SellerApplyPage from './pages/my/SellerApplyPage.jsx';
import SellerCenterPage from './pages/my/SellerCenterPage.jsx';
import CategoryPage from './pages/category/CategoryPage.jsx';
import ProductListPage from './pages/category/ProductListPage.jsx';
import ProductDetailPage from './pages/category/ProductDetailPage.jsx';
import WishProductsPage from './pages/wish/WishProductsPage.jsx';
import WishShopsPage from './pages/wish/WishShopsPage.jsx';
import CartPage from './pages/cart/CartPage.jsx';
import { storeApi } from './api/store.api.js';
import * as productApi from './api/product.api.js';
import client from './api/client.js';
import { cartApi } from './api/cart.api.js';
import { supabase } from './lib/supabase.js';
import FulfillmentSheet from './pages/wish/components/FulfillmentSheet.jsx';
import { searchApi } from './api/search.api.js';
import { bannerApi, homeApi } from './api/home.api.js';
import ServiceIntroPage from './pages/home/ServiceIntroPage.jsx';
import InterestSettingsPage from './pages/home/InterestSettingsPage.jsx';
import {
  loadInterestBrands,
  loadInterestIds,
  saveInterestBrands,
  saveInterestIds,
} from './pages/home/interestStorage.js';
import AdDetailPage from './pages/home/AdDetailPage.jsx';
import AdProductsPage from './pages/home/AdProductsPage.jsx';
import ExhibitionPage from './pages/home/ExhibitionPage.jsx';
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

// 배너 종류별 상세 화면. 팬 응원 전광판(FAN)은 상세 화면이 없어 이동하지 않는다.
const BANNER_DETAIL_PATHS = {
  SERVICE_INTRO: '/intro',
  AD: '/ads',
  EXHIBITION: '/exhibitions',
};

function bannerPath({ bannerId, bannerType }) {
  const base = BANNER_DETAIL_PATHS[bannerType];
  return base ? `${base}/${bannerId}` : null;
}

// 홈 카테고리 바로가기는 카테고리 탭과 같은 방식으로 이동한다.
// 작품(CONTENT)은 카테고리 탭에서 해당 작품을 고른 상태로, 굿즈 종류(GOODS)는 상품 목록으로 간다.
function categoryPath({ type, categoryId, name }) {
  if (type === 'ALL') return '/category';
  if (type === 'CONTENT') return `/category?${new URLSearchParams({ contentCategoryId: categoryId })}`;
  return `/category/products?${new URLSearchParams({ contentName: '전체', goodsCategoryId: categoryId, goodsType: name })}`;
}

// "지금 뜨는 굿즈" 전체보기: 카테고리 탭의 전체 > 모두 보기 결과를 굿즈 탭으로 열고,
// 홈에서 고른 인기/신상품 탭을 정렬(인기순/최신순)로 넘긴다.
function trendingPath(tab) {
  return `/category/products?${new URLSearchParams({
    contentName: '전체',
    allGoods: 'true',
    resultType: 'goods',
    sort: tab === 'new' ? 'newest' : 'popular',
  })}`;
}

// "입고 예정 상품" 전체보기: 전체 > 모두 보기 굿즈 결과를 열고,
// 필터의 판매 상태는 "입고 예정 상품 포함"만 체크(품절 상품 포함은 OFF)하고, 홈과 같은 순서(오픈이 가까운 순)로 보여준다.
const UPCOMING_PATH = `/category/products?${new URLSearchParams({
  contentName: '전체',
  allGoods: 'true',
  resultType: 'goods',
  includeUpcoming: 'true',
  includeSoldOut: 'false',
  sort: 'upcoming',
})}`;

// "품절 임박 상품" 전체보기: 전체 > 모두 보기 굿즈 결과를 재고 적은 순으로 보여준다.
// 판매 상태 기본값(재고 있는 상품만)이 적용돼 품절 상품은 나오지 않는다.
const LOW_STOCK_PATH = `/category/products?${new URLSearchParams({
  contentName: '전체',
  allGoods: 'true',
  resultType: 'goods',
  sort: 'stock_asc',
})}`;

function HomeRoute() {
  const navigate = useNavigate();
  const openCategory = (category) => navigate(categoryPath(category));
  const homeQuery = useQuery({
    queryKey: ['home'],
    queryFn: homeApi.get,
    staleTime: 30000,
    retry: false,
  });

  if (homeQuery.isPending) return <p className="home-status">불러오는 중...</p>;
  if (homeQuery.isError) {
    return (
      <div className="home-status">
        <p>{homeQuery.error.message}</p>
        <button type="button" onClick={() => homeQuery.refetch()}>다시 시도</button>
      </div>
    );
  }

  return (
    <HomePage
      data={{ ...homeMockData, ...homeQuery.data.data }}
      {...homeMockUserState}
      interestCategoryIds={loadInterestIds() ?? homeMockUserState.interestCategoryIds}
      interestBrands={loadInterestBrands()}
      onOpenInterestSettings={() => navigate('/interests')}
      onSearch={() => navigate('/search')}
      onOpenCart={() => navigate('/cart')}
      onOpenProduct={(product) => navigate(`/products/${product.storeProductId}`)}
      onOpenCategory={openCategory}
      onOpenTrending={(tab) => navigate(trendingPath(tab))}
      onOpenUpcoming={() => navigate(UPCOMING_PATH)}
      onOpenLowStock={() => navigate(LOW_STOCK_PATH)}
      onBannerClick={(bannerId) => {
        bannerApi.click(bannerId).catch(() => {
          // 클릭 기록 실패가 화면 이동을 막지 않는다.
        });
      }}
      onNavigate={(link) => {
        const path = bannerPath(link);
        if (path) navigate(path);
      }}
    />
  );
}

// 배너 상세 화면 공통: 주소의 bannerId 로 데이터를 불러오고, 뒤로가기는 홈으로 돌아간다.
function useBannerDetailRoute(queryFn) {
  const navigate = useNavigate();
  const { bannerId } = useParams();
  const query = useQuery({
    queryKey: ['home-banner-detail', bannerId, queryFn.name],
    queryFn: () => queryFn(bannerId),
    retry: false,
  });

  return {
    banner: query.data?.data,
    error: query.error?.message,
    onRetry: () => query.refetch(),
    onBack: () => (window.history.length > 1 ? navigate(-1) : navigate('/')),
    onOpenProduct: (product) => navigate(`/products/${product.storeProductId}`),
    onOpenStore: (storeId) => navigate(`/stores/${storeId}`),
    onHome: () => navigate('/'),
    navigate,
  };
}

function ServiceIntroRoute() {
  const route = useBannerDetailRoute(homeApi.serviceIntro);
  return (
    <ServiceIntroPage
      intro={route.banner}
      error={route.error}
      onBack={route.onBack}
      onRetry={route.onRetry}
      onOpenStore={route.onOpenStore}
      onFindStores={() => route.navigate('/stores?sort=distance')}
    />
  );
}

function AdDetailRoute() {
  const route = useBannerDetailRoute(homeApi.ad);
  return (
    <AdDetailPage
      ad={route.banner}
      error={route.error}
      onBack={route.onBack}
      onRetry={route.onRetry}
      onOpenProduct={route.onOpenProduct}
      onOpenStore={route.onOpenStore}
      onShowProducts={() => route.navigate(`/ads/${route.banner.id}/products`)}
    />
  );
}

function AdProductsRoute() {
  const navigate = useNavigate();
  const { bannerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const sort = searchParams.get('sort') ?? 'discount';
  const query = useQuery({
    queryKey: ['home-ad-products', bannerId, sort],
    queryFn: () => homeApi.adProducts(bannerId, { sort }),
    placeholderData: (previous) => previous,
    retry: false,
  });

  return (
    <AdProductsPage
      list={query.data?.data}
      error={query.error?.message}
      onBack={() => (window.history.length > 1 ? navigate(-1) : navigate(`/ads/${bannerId}`))}
      onRetry={() => query.refetch()}
      onChangeSort={(next) => setSearchParams(next === 'discount' ? {} : { sort: next }, { replace: true })}
      onOpenProduct={(product) => navigate(`/products/${product.storeProductId}`)}
      onOpenStore={(storeId) => navigate(`/stores/${storeId}`)}
    />
  );
}

function ExhibitionRoute() {
  const navigate = useNavigate();
  const { bannerId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const character = searchParams.get('character') ?? '';
  const type = searchParams.get('type') ?? '';
  const inStock = searchParams.get('inStock') === 'true';
  // 캐릭터·종류·재고 조건이 바뀌면 그 기준으로 굿즈를 다시 불러온다.
  const query = useQuery({
    queryKey: ['home-exhibition', bannerId, character, type, inStock],
    queryFn: () => homeApi.exhibition(bannerId, { character, type, inStock: inStock || undefined }),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const setFilter = (values) => setSearchParams((current) => {
    const next = new URLSearchParams(current);
    Object.entries(values).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    return next;
  }, { replace: true });

  return (
    <ExhibitionPage
      exhibition={query.data?.data}
      loading={query.isFetching}
      error={query.error?.message}
      filters={{ type, inStock }}
      onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      onRetry={() => query.refetch()}
      onSelectCharacter={(name) => setFilter({ character: name, type: '' })}
      onChangeType={(nextType) => setFilter({ type: nextType })}
      onToggleInStock={() => setFilter({ inStock: inStock ? '' : 'true' })}
      onOpenProduct={(product) => navigate(`/products/${product.storeProductId}`)}
      onShowAll={(name) => navigate(`/search/results?q=${encodeURIComponent(name)}`)}
    />
  );
}

function InterestRoute() {
  const navigate = useNavigate();
  const homeQuery = useQuery({ queryKey: ['home'], queryFn: homeApi.get, staleTime: 30000, retry: false });
  const categories = homeQuery.data?.data.interestCategories;
  if (!categories && !homeQuery.error) return <p className="home-status">불러오는 중...</p>;

  return (
    <InterestSettingsPage
      categories={categories}
      initialIds={loadInterestIds() ?? homeMockUserState.interestCategoryIds}
      initialBrands={loadInterestBrands()}
      error={homeQuery.error?.message}
      onBack={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
      onRetry={() => homeQuery.refetch()}
      onSave={(ids, brands) => {
        saveInterestIds(ids);
        saveInterestBrands(brands);
        navigate('/');
      }}
    />
  );
}

// 상품 상세: 로그인 사용자를 알려 주고, 장바구니 담기를 수령 방법(픽업/배달) 선택 후 /cart/items로 연결한다.
function ProductDetailRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeProductId } = useParams();
  const [user, setUser] = useState(null);
  const [sheet, setSheet] = useState(null);
  const detail = useQuery({
    queryKey: ['product-detail-name', storeProductId],
    queryFn: () => productApi.getProductDetail(storeProductId, {}, client),
    retry: false,
  });
  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const addToCart = (fulfillmentType) =>
    cartApi.addItem({ storeProductId, quantity: 1, fulfillmentType });
  return (
    <>
      <ProductDetailPage
        user={user}
        onLogin={() =>
          navigate(`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`)
        }
        actions={{
          // 담은 뒤에는 수령 방법을 바꿀 수 없어서, 자동으로 고르지 않고 시트로 먼저 묻는다.
          cart: () =>
            new Promise((resolve, reject) => {
              setSheet({ resolve, reject });
            }),
        }}
      />
      {sheet && (
        <FulfillmentSheet
          productName={detail.data?.productName || detail.data?.name || '이 상품'}
          isPending={sheet.pending}
          onCancel={() => {
            sheet.reject(Object.assign(new Error('취소'), { cancelled: true }));
            setSheet(null);
          }}
          onSelect={async (fulfillmentType) => {
            setSheet({ ...sheet, pending: true });
            try {
              await addToCart(fulfillmentType);
              sheet.resolve();
              setSheet(null);
              navigate(`/cart?type=${fulfillmentType}`);
            } catch (error) {
              sheet.reject(error);
              setSheet(null);
            }
          }}
        />
      )}
    </>
  );
}

function SearchRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get('storeId');
  const query = searchParams.get('q') ?? '';
  const originStoreId = storeId || location.state?.originStoreId;
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
      initialQuery={query}
      data={searchMockData}
      shops={shopsQuery.data ?? EMPTY_STORES}
      storeId={storeId}
      storeName={storeQuery.data?.data.name}
      storeError={storeQuery.error?.message}
      onClearStore={(currentQuery) => navigate(searchUrl('/search', { query: currentQuery }), { state: { originStoreId } })}
      onBack={() => navigate(originStoreId ? `/stores/${encodeURIComponent(originStoreId)}` : '/')}
      onSearch={(nextQuery) => navigate(searchUrl('/search/results', { query: nextQuery, storeId }), { state: { originStoreId } })}
    />
  );
}

function SearchResultsRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const storeId = searchParams.get('storeId');
  const originStoreId = storeId || location.state?.originStoreId;
  const searchState = originStoreId ? { originStoreId } : undefined;
  const sort = searchParams.get('sort') ?? 'popular';
  const page = Number(searchParams.get('page') ?? 1);
  const regionAll = searchParams.get('region') === 'all';
  // 상품 상세의 "비슷한 상품을 취급하는 굿즈샵 전체보기"에서 오면 그 추천 굿즈샵을 굿즈샵 탭에 보여준다.
  const similarTo = searchParams.get('similarTo');
  const parsedQuery = parseRegionalQuery(query, searchMockData);
  // 지역명만 검색한 경우 굿즈는 지역 안의 모든 상품이 아니라 이름에 그 글자가 든 상품만 찾는다.
  const regionOnly = Boolean(!storeId && parsedQuery.region && !parsedQuery.keyword);
  const region = !storeId && !regionAll && !regionOnly && !similarTo ? parsedQuery.region?.label : undefined;
  // 전국에서 보기에서는 지역명도 검색어로 보고, 이름에 포함된 굿즈·굿즈샵을 찾는다.
  // 비슷한 상품 기준(similarTo)에서는 검색어 대신 비슷한 상품 범위로 찾는다.
  const keyword = similarTo && !storeId ? '' : storeId || regionAll || regionOnly ? query : parsedQuery.keyword;
  const filterKey = `${storeId ?? ''}:${query}`;
  const [savedFilters, setSavedFilters] = useState({ key: filterKey, value: { ...EMPTY_FILTERS } });
  const appliedFilters = savedFilters.key === filterKey ? savedFilters.value : EMPTY_FILTERS;
  const activeParams = filterParams(appliedFilters);
  // 품절·입고 예정 제외는 기본값이라 사용자가 건 필터로 보지 않는다.
  const hasActiveFilters = Object.entries(activeParams).some(
    ([key, value]) => value !== undefined && !['includeSoldOut', 'includeUpcoming'].includes(key)
  );
  const regionalBaselineQuery = useQuery({
    queryKey: ['search-region-baseline', keyword, region],
    queryFn: () => searchApi.products({ q: keyword, region, size: 1 }),
    enabled: Boolean(!storeId && hasActiveFilters && region && keyword),
    retry: false,
  });
  const filteredNationwideFallback = Boolean(hasActiveFilters && region && regionalBaselineQuery.data?.data.totalCount === 0);
  const productRegion = filteredNationwideFallback ? undefined : region;
  const storeQuery = useStoreFilter(storeId);
  const productsQuery = useQuery({
    queryKey: ['search-products', storeId, keyword, productRegion, sort, page, activeParams, similarTo],
    queryFn: () => searchApi.products({ storeId: storeId || undefined, similarTo: (!storeId && similarTo) || undefined, q: keyword, region: productRegion, sort, page, size: 20, ...activeParams }),
    enabled: Boolean(query || storeId),
    retry: false,
  });
  const needsNationwideFallback = filteredNationwideFallback || Boolean(!storeId && !hasActiveFilters && region && keyword && productsQuery.data?.data.totalCount === 0);
  const nationwideQuery = useQuery({
    queryKey: ['search-products', null, keyword, null, sort, page, activeParams],
    queryFn: () => searchApi.products({ q: keyword, sort, page, size: 20, ...activeParams }),
    enabled: needsNationwideFallback && !hasActiveFilters,
    retry: false,
  });
  const similarStoresQuery = useQuery({
    queryKey: ['search-similar-stores', similarTo],
    queryFn: () => productApi.getSimilarStores(similarTo, { size: 30, includeCurrent: true }, client),
    enabled: Boolean(similarTo && !storeId),
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
      products={(needsNationwideFallback && !hasActiveFilters ? nationwideQuery.data : productsQuery.data)?.data.items ?? []}
      productTotalCount={(needsNationwideFallback && !hasActiveFilters ? nationwideQuery.data : productsQuery.data)?.data.totalCount ?? 0}
      similarBasis={similarTo && !storeId ? query : undefined}
      currentShopId={(similarStoresQuery.data ?? []).find((store) => store.isCurrent)?.id}
      shops={shopsQuery.data ?? EMPTY_STORES}
      similarShopIds={similarTo && !similarStoresQuery.isPending ? (similarStoresQuery.data ?? []).map((store) => store.id) : undefined}
      initialResultType={searchParams.get('tab') === 'shops' ? 'shops' : undefined}
      storeId={storeId}
      storeName={storeQuery.data?.data.name}
      storeError={storeQuery.error?.message || productsQuery.error?.message}
      scopedLoading={Boolean(storeId && (storeQuery.isPending || productsQuery.isPending))}
      scopedTotalCount={productsQuery.data?.data.totalCount ?? 0}
      globalLoading={Boolean(!storeId && (productsQuery.isPending || shopsQuery.isPending || (similarTo && !storeId && similarStoresQuery.isPending) || (hasActiveFilters && region && regionalBaselineQuery.isPending) || (needsNationwideFallback && !hasActiveFilters && nationwideQuery.isPending)))}
      globalError={!storeId ? productsQuery.error?.message || (hasActiveFilters && region && regionalBaselineQuery.error?.message) || (needsNationwideFallback && !hasActiveFilters && nationwideQuery.error?.message) || shopsQuery.error?.message : null}
      showTabsWhenEmpty={Boolean(!storeId && originStoreId)}
      hasActiveFilters={hasActiveFilters}
      regionEnabled={!regionAll}
      useNationwideFallback={needsNationwideFallback}
      sort={sort}
      page={page}
      onRetry={() => { if (storeId) storeQuery.refetch(); productsQuery.refetch(); if (hasActiveFilters && region) regionalBaselineQuery.refetch(); if (needsNationwideFallback && !hasActiveFilters) nationwideQuery.refetch(); if (!storeId) shopsQuery.refetch(); }}
      onClearStore={(currentQuery) => navigate(searchUrl(currentQuery.trim() ? '/search/results' : '/search', { query: currentQuery.trim(), sort, regionAll }), { state: searchState })}
      onSortChange={(nextSort) => navigate(searchUrl('/search/results', { query, storeId, sort: nextSort, regionAll }), { state: searchState })}
      onPageChange={(nextPage) => navigate(searchUrl('/search/results', { query, storeId, sort, page: nextPage, regionAll }), { state: searchState })}
      onDisableRegion={() => navigate(searchUrl('/search/results', { query, storeId, sort, regionAll: true }), { state: searchState })}
      onEnableRegion={() => navigate(searchUrl('/search/results', { query, storeId, sort }), { state: searchState })}
      filterState={appliedFilters}
      filterQuery={keyword}
      filterRegion={needsNationwideFallback ? undefined : region}
      onFilterChange={(nextFilters) => {
        setSavedFilters({ key: filterKey, value: nextFilters });
        if (page > 1) navigate(searchUrl('/search/results', { query, storeId, sort, regionAll }), { state: searchState });
      }}
      onBack={() => navigate(searchUrl('/search', { query, storeId }), { state: searchState })}
      // 결과 화면에서 다시 검색하면 이전 정렬을 이어받지 않고 처음 검색할 때처럼 시작한다.
      onSearch={(nextQuery) => navigate(searchUrl('/search/results', { query: nextQuery, storeId }), { state: searchState })}
      onLogSearch={logSearch}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* 공용 — 라우트는 전부 여기 미리 등록. 수정 전 단톡 공지. */}
      <Routes>
        {/* 민주 — 홈 · 검색 */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/interests" element={<InterestRoute />} />
        <Route path="/search" element={<SearchRoute />} />
        <Route path="/search/results" element={<SearchResultsRoute />} />
        <Route path="/intro/:bannerId" element={<ServiceIntroRoute />} />
        <Route path="/ads/:bannerId" element={<AdDetailRoute />} />
        <Route path="/ads/:bannerId/products" element={<AdProductsRoute />} />
        <Route path="/exhibitions/:bannerId" element={<ExhibitionRoute />} />

        {/* 여경 — 굿즈샵 */}
        <Route path="/stores" element={<StoreListPage />} />
        <Route path="/stores/:storeId" element={<StoreDetailPage />} />
        <Route path="/stores/:storeId/reviews" element={<StoreReviewPage />} />
        <Route path="/stores/:storeId/reviews/write" element={<StoreReviewWritePage />} />

        {/* 은혜 — 카테고리 · 상품 */}
        <Route path="/category" element={<CategoryPage />} />
        <Route path="/category/products" element={<ProductListPage />} />
        <Route path="/products/:storeProductId" element={<ProductDetailRoute />} />

        {/* 동균 — 찜 · 장바구니 */}
        <Route path="/wish" element={<WishProductsPage />} />
        <Route path="/wish/shops" element={<WishShopsPage />} />
        <Route path="/cart" element={<CartPage />} />

        {/* 연수 — 로그인 · 결제 · 마이 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup/terms" element={<SignupTermsPage />} />
        <Route path="/signup/info" element={<SignupInfoPage />} />
        <Route path="/signup/done" element={<SignupDonePage />} />
        <Route path="/find-password" element={<FindPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/complete/:groupId" element={<OrderCompletePage />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="/my/orders" element={<OrdersPage />} />
        <Route path="/my/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="/my/orders/:orderId/review" element={<ReviewWritePage />} />
        <Route path="/my/membership" element={<MembershipPage />} />
        <Route path="/my/coupons" element={<CouponsPage />} />
        <Route path="/my/coupons/:couponId" element={<CouponDetailPage />} />
        <Route path="/my/addresses" element={<AddressesPage />} />
        <Route path="/my/addresses/new" element={<AddressFormPage />} />
        <Route path="/my/addresses/:addressId/edit" element={<AddressFormPage />} />
        <Route path="/my/payment-methods" element={<PaymentMethodsPage />} />
        <Route path="/my/settings/notifications" element={<NotificationSettingsPage />} />
        <Route path="/my/profile" element={<ProfilePage />} />
        <Route path="/my/support" element={<SupportPage />} />
        <Route path="/my/support/notices" element={<NoticeListPage />} />
        <Route path="/my/support/notices/:noticeId" element={<NoticeDetailPage />} />
        <Route path="/my/support/inquiries" element={<InquiryListPage />} />
        <Route path="/my/support/inquiries/new" element={<InquiryFormPage />} />
        <Route path="/my/support/reports" element={<ReportListPage />} />
        <Route path="/my/terms" element={<TermsPage />} />
        <Route path="/my/terms/:type" element={<TermsBodyPage />} />
        <Route path="/my/seller-apply" element={<SellerApplyPage />} />
        <Route path="/my/seller-center" element={<SellerCenterPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
