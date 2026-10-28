import BottomNavigation from '../../../components/BottomNavigation.jsx';
import { StoreHeader } from '../../stores/components/StoreShell.jsx';
import '../../../App.css';
import './categoryDevelop.css';
import { useCallback, useState } from 'react';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import CategoryPage from '../CategoryPage';
import ProductListPage from '../ProductListPage';
import ProductDetailPage from '../ProductDetailPage';
import { createCategoryMock, demoUser, demoCategories, demoRegions } from './categoryMock';
import CategoryProductCard from './CategoryProductCard.jsx';
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
    <ProductListPage embedded
      api={productApi}
      client={apiClient}
      user={null}
      ProductCard={CategoryProductCard}
      regions={[]}
      categories={request.data || []}
    />
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
      <div className="app-shell category-develop-shell">
        <StoreHeader />
        <Routes>
          <Route
            path="/category"
            element={
              <CategoryPage embedded
                api={live ? categoryApi : mock.api}
                productApi={live ? productApi : mock.api}
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
                <ProductListPage embedded
                  api={mock.api}
                  user={user}
                  ProductCard={CategoryProductCard}
                  regions={demoRegions}
                  categories={demoCategories}
                />
              )
            }
          />
          <Route
            path="/products/:storeProductId"
            element={
              <ProductDetailPage embedded
                api={live ? productApi : mock.api}
                inquiryApi={live ? inquiryApi : mock.api}
                client={live ? apiClient : undefined}
                user={live ? null : user}
                ProductCard={CategoryProductCard}
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
        <BottomNavigation />
      </div>
    </MemoryRouter>
  );
}
