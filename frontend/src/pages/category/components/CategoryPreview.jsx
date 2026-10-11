import { useCallback, useState } from 'react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import CategoryPage from '../CategoryPage';
import ProductListPage from '../ProductListPage';
import ProductDetailPage from '../ProductDetailPage';
import { createCategoryMock, demoUser, demoCategories, demoRegions } from './categoryMock';
import './categoryPreview.css';
import apiClient from '../../../api/client.js';
import * as categoryApi from '../../../api/category.api.js';
import * as productApi from '../../../api/product.api.js';
import * as inquiryApi from '../../../api/productInquiry.api.js';
import useCategoryRequest from './useCategoryRequest';
import ProductEmptyState from './ProductEmptyState';

function LiveProductList() {
  const load = useCallback((signal) => categoryApi.getCategories({ signal }, apiClient), []);
  const request = useCategoryRequest(load);
  if (request.loading)
    return (
      <main className="category-page">
        <p role="status">카테고리를 불러오는 중입니다.</p>
      </main>
    );
  if (request.error)
    return (
      <main className="category-page">
        <ProductEmptyState message="카테고리를 불러오지 못했습니다." onRetry={request.retry} />
      </main>
    );
  // No shared region endpoint exists yet. Never submit mock region UUIDs to the live API.
  return (
    <ProductListPage
      api={productApi}
      client={apiClient}
      user={null}
      ProductCard={DemoProductSummary}
      regions={[]}
      categories={request.data || []}
    />
  );
}

function PreviewProductImage({ src, name }) {
  const [failed, setFailed] = useState(false);
  return !src || failed ? (
    <div
      role="img"
      aria-label={name}
      className="category-image-placeholder"
      style={{ aspectRatio: 1 }}
    >
      이미지 준비 중
    </div>
  ) : (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: '100%', aspectRatio: 1, borderRadius: 10, objectFit: 'cover' }}
    />
  );
}

function PreviewIcon({ name }) {
  const paths = {
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    cart: 'M2 3h3l3 13h11l3-10H6M9 21h.01M19 21h.01',
    home: 'M3 10l9-8 9 8v11h-6v-7H9v7H3z',
    store: 'M3 10V4h18v6M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M5 13v8h14v-8',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    heart: 'M12 21L3 12C-3 4 7-1 12 6c5-7 15-2 9 6z',
    user: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0M3 22v-3a9 9 0 0 1 18 0v3z',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

// Preview-only visual stand-in, injected into pages. Production uses the team's ProductCard.
function DemoProductSummary({ product }) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 14, padding: 12 }}>
      <PreviewProductImage
        key={product.thumbnailUrl || 'empty'}
        src={product.thumbnailUrl}
        name={product.productName}
      />
      <h3>{product.productName}</h3>
      <p>{product.price.toLocaleString('ko-KR')}원</p>
      <p>
        {product.storeName} ·{' '}
        {{ ON_SALE: '판매 중', SOLD_OUT: '품절', UPCOMING: '입고 예정' }[product.displayStatus]}
      </p>
    </article>
  );
}

export default function CategoryPreview({ live = false }) {
  const [user, setUser] = useState(demoUser);
  const [mock] = useState(() => createCategoryMock());
  function login(next) {
    mock.setUser(next);
    setUser(next);
  }
  return (
    <MemoryRouter initialEntries={['/category']}>
      <div
        className="category-preview-controls"
        style={{
          padding: 16,
          background: '#f3ecff',
          color: '#302143',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <strong>카테고리 미리보기 · {live ? '실제 데이터 · 조회 전용' : '샘플 데이터'}</strong>
        <Link to="/category">카테고리</Link>
        <Link to="/category/products">전체 상품</Link>
        {!live && (
          <button type="button" onClick={() => login(user ? null : demoUser)}>
            {user ? '비로그인 상태 보기' : '샘플 로그인'}
          </button>
        )}
        <small>
          {live
            ? '로그인·문의 등록·구매 기능은 아직 연결되지 않았습니다.'
            : 'DB 요청 없음 · 문의와 버튼 동작은 새로고침하면 초기화됩니다.'}
        </small>
      </div>
      <div className="category-preview-app">
        <header className="category-preview-header">
          <Link to="/category" className="category-preview-brand" aria-label="굿즈픽 카테고리">
            굿즈<span>픽</span>
          </Link>
          <div className="category-preview-header-icons">
            <Link to="/category/products" aria-label="상품 찾아보기">
              <PreviewIcon name="search" />
            </Link>
            <button type="button" disabled aria-label="알림 (미리보기 미지원)">
              <PreviewIcon name="bell" />
            </button>
            <button type="button" disabled aria-label="장바구니 (미리보기 미지원)">
              <PreviewIcon name="cart" />
              <span className="category-preview-badge">3</span>
            </button>
          </div>
        </header>
        <Routes>
          <Route
            path="/category"
            element={
              <CategoryPage
                api={live ? categoryApi : mock.api}
                client={live ? apiClient : undefined}
              />
            }
          />
          <Route
            path="/category/products"
            element={
              live ? (
                <LiveProductList />
              ) : (
                <ProductListPage
                  api={mock.api}
                  user={user}
                  ProductCard={DemoProductSummary}
                  regions={demoRegions}
                  categories={demoCategories}
                />
              )
            }
          />
          <Route
            path="/products/:storeProductId"
            element={
              <ProductDetailPage
                api={live ? productApi : mock.api}
                inquiryApi={live ? inquiryApi : mock.api}
                client={live ? apiClient : undefined}
                user={live ? null : user}
                ProductCard={DemoProductSummary}
                actions={live ? undefined : mock.actions}
                onLogin={live ? undefined : () => login(demoUser)}
              />
            }
          />
          <Route
            path="/stores/:storeId"
            element={
              <main className="category-page">
                <h1>굿즈샵 상세</h1>
                <p>굿즈샵 담당 화면의 연결 자리입니다.</p>
                <Link to="/category/products">상품 목록으로</Link>
              </main>
            }
          />
        </Routes>
        <nav className="category-preview-tabs" aria-label="미리보기 하단 탭">
          <button type="button" disabled>
            <PreviewIcon name="home" />
            <span>홈</span>
          </button>
          <button type="button" disabled>
            <PreviewIcon name="store" />
            <span>굿즈샵</span>
          </button>
          <Link to="/category" className="is-selected">
            <PreviewIcon name="grid" />
            <span>카테고리</span>
          </Link>
          <button type="button" disabled>
            <PreviewIcon name="heart" />
            <span>찜</span>
          </button>
          <button type="button" disabled>
            <PreviewIcon name="user" />
            <span>마이</span>
          </button>
        </nav>
      </div>
    </MemoryRouter>
  );
}
