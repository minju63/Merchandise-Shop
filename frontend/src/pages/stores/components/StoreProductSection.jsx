import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../../api/store.api.js';
import Icon from './Icon.jsx';
import { AvailabilityBadges, ImageWithFallback, PageState } from './StoreShell.jsx';

// 이미지를 덮는 상태: 출시 예정 / 재입고 예정 / 품절
const OVERLAY_LABELS = { coming: 'COMING SOON', restock: 'RESTOCK SOON', soldout: 'SOLD OUT' };

export default function StoreProductSection({ storeId, searchContext }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-products', storeId, 'popular', page],
    queryFn: () => storeApi.products(storeId, { sort: 'popular', page, size: 20 }),
  });
  const products = data?.data;
  return (
    <section className="product-section">
      <div className="section-heading">
        <strong>전체 {products?.totalCount ?? 0}개</strong>
        <Link
          className="product-view-all"
          to={`/search/results?storeId=${encodeURIComponent(searchContext.storeId)}`}
        >
          굿즈 전체보기 ›
        </Link>
      </div>
      {isPending ? (
        <div className="product-grid">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="product-skeleton" />
          ))}
        </div>
      ) : isError ? (
        <PageState onRetry={refetch}>{error.message}</PageState>
      ) : products.items.length ? (
        <>
          {products.purchasableCount === 0 && (
            <p className="muted">현재 구매 가능한 상품이 없습니다.</p>
          )}
          <div className="product-grid">
            {products.items.map((product) => (
              <article className="product-card" key={product.storeProductId}>
                <Link
                  className="product-card-link"
                  to={`/products/${encodeURIComponent(product.storeProductId)}`}
                  state={{ listReturnTo: `/stores/${encodeURIComponent(storeId)}` }}
                >
                  <div className="product-picture">
                    <ImageWithFallback src={product.image} alt={product.name} />
                    {product.overlay && (
                      <div className="sold-out-dim" aria-hidden="true">
                        <span>{OVERLAY_LABELS[product.overlay]}</span>
                      </div>
                    )}
                    <span className="product-heart" aria-hidden="true">
                      <Icon name="heart" size={19} />
                    </span>
                  </div>
                  <h3>{product.name}</h3>
                  <strong className="product-price">
                    {product.price == null
                      ? '가격 정보 없음'
                      : `${product.price.toLocaleString('ko-KR')}원`}
                  </strong>
                  {product.stockLabel && (
                    <span className="stock-label sold-out">{product.stockLabel}</span>
                  )}
                  <AvailabilityBadges
                    pickup={product.pickupAvailable}
                    delivery={product.deliveryAvailable}
                  />
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <PageState>판매 중인 상품이 없습니다.</PageState>
      )}
      <div className="pagination">
        {page > 1 && (
          <button className="secondary-button" onClick={() => setPage(page - 1)}>
            이전
          </button>
        )}
        {products?.totalCount > page * 20 && (
          <button className="secondary-button" onClick={() => setPage(page + 1)}>
            다음
          </button>
        )}
      </div>
    </section>
  );
}
