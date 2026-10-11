import CategoryLayout from './components/CategoryLayout.jsx';
import CategoryProductCard from './components/CategoryProductCard.jsx';
import sharedClient from '../../api/client.js';
import { useCallback, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import * as productApi from '../../api/product.api';
import ProductImageGallery from './components/ProductImageGallery';
import ProductInfo from './components/ProductInfo';
import ProductDescription from './components/ProductDescription';
import SellerInfoCard from './components/SellerInfoCard';
import RelatedProductSection from './components/RelatedProductSection';
import ProductInquirySection from './components/ProductInquirySection';
import ProductActionBar from './components/ProductActionBar';
import ProductEmptyState from './components/ProductEmptyState';
import useCategoryRequest from './components/useCategoryRequest';
import './components/category.css';

// Mount as /products/:storeProductId; shared actions and auth are injected by the route owner.
function ProductDetailPageContent({
  client = sharedClient,
  ProductCard = CategoryProductCard,
  user,
  actions,
  onLogin,
  api = productApi,
  inquiryApi,
}) {
  const [feedbackTab, setFeedbackTab] = useState('reviews');
  const { storeProductId } = useParams();
  const location = useLocation();
  const listReturnTo = location.state?.listReturnTo?.startsWith('/category/products')
    ? location.state.listReturnTo
    : '/category/products';
  const load = useCallback(
    (signal) => api.getProductDetail(storeProductId, { signal }, client),
    [api, client, storeProductId]
  );
  const relatedLoad = useCallback(
    (signal) => api.getRelatedProducts(storeProductId, { signal }, client),
    [api, client, storeProductId]
  );
  const request = useCategoryRequest(load, user?.id);
  const related = useCategoryRequest(relatedLoad, user?.id);
  if (request.loading)
    return (
      <main className="category-page">
        <p role="status">상품을 불러오는 중입니다.</p>
      </main>
    );
  if (request.error || !request.data || ['HIDDEN', 'DELETED'].includes(request.data.status)) {
    const notFound = request.error?.response?.status === 404 || !request.error;
    return (
      <main className="category-page">
        <Link to="/category">카테고리로 돌아가기</Link>
        <ProductEmptyState
          message={notFound ? '상품을 찾을 수 없습니다.' : '상품을 불러오지 못했습니다.'}
          onRetry={notFound ? undefined : request.retry}
        />
      </main>
    );
  }
  const product = request.data;
  return (
    <main className="category-page category-detail">
      <Link className="category-detail-back" to={listReturnTo}>
        ← 상품 목록
      </Link>
      <div id="product-basic" className="category-detail-top">
        <ProductImageGallery
          key={storeProductId}
          images={product.images}
          thumbnailUrl={product.thumbnailUrl}
          productName={product.productName || product.name}
          soldOut={
            product.displayStatus === 'SOLD_OUT' ||
            product.status === 'SOLD_OUT' ||
            (product.status === 'ON_SALE' && product.stock <= 0)
          }
        />
        <ProductInfo product={product} />
      </div>
      <div className="category-primary-seller">
        <SellerInfoCard store={product.store} storeId={product.storeId} storeName={product.storeName} />
      </div>
      <div id="product-description">
      <ProductDescription
        description={product.description}
        spec={product.spec}
        images={product.images}
      />
      </div>
      <div id="product-sellers">
      <SellerInfoCard
        store={product.store}
        storeId={product.storeId}
        storeName={product.storeName}
      />
      </div>
      <div id="product-related">
      <RelatedProductSection
        products={related.data}
        ProductCard={ProductCard}
        loading={related.loading}
        error={related.error}
        onRetry={related.retry}
      />
      </div>
      <section id="product-feedback" className="category-section">
        <nav className="category-result-tabs" aria-label="리뷰와 상품 문의">
          <button type="button" aria-pressed={feedbackTab === 'reviews'} onClick={() => setFeedbackTab('reviews')}>리뷰</button>
          <button type="button" aria-pressed={feedbackTab === 'inquiries'} onClick={() => setFeedbackTab('inquiries')}>Q&A</button>
        </nav>
        {feedbackTab === 'reviews' ? <ProductEmptyState message="상품 리뷰는 아직 연결되지 않았습니다." /> : <ProductInquirySection
        key={storeProductId}
        storeProductId={storeProductId}
        client={client}
        user={user}
        onLogin={onLogin}
        api={inquiryApi}
      />}
      </section>
      <ProductActionBar
        key={`${storeProductId}:${user?.id || 'guest'}`}
        product={product}
        user={user}
        actions={actions}
        onLogin={onLogin}
      />
    </main>
  );
}

export default function ProductDetailPage({ embedded = false, ...props }) {
  return <CategoryLayout embedded={embedded}><ProductDetailPageContent {...props} /></CategoryLayout>;
}
