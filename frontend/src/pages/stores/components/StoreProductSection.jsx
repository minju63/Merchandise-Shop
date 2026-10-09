import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../../api/store.api.js';
import Icon from './Icon.jsx';
import StoreSort from './StoreSort.jsx';
import { AvailabilityBadges, ImageWithFallback, PageState } from './StoreShell.jsx';

const sorts = [
  { value: 'popular', label: '인기순' },
  { value: 'sales', label: '판매순' },
  { value: 'newest', label: '신규순' },
  { value: 'stock', label: '재고 많은 순' },
];

export default function StoreProductSection({ storeId, searchContext }) {
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-products', storeId, sort, page],
    queryFn: () => storeApi.products(storeId, { sort, page, size: 20 }),
  });
  const products = data?.data;
  return (
    <section className="product-section">
      <div className="section-heading">
        <strong>전체 {products?.totalCount ?? 0}개</strong>
        <StoreSort
          value={sort}
          options={sorts}
          onChange={(value) => {
            setSort(value);
            setPage(1);
          }}
        />
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
                <div className="product-picture">
                  <ImageWithFallback src={product.image} alt={product.name} />
                  {/* TODO: 공통 상품 찜 API는 storeProductId로 연결 */}
                  <button
                    className="product-heart"
                    disabled
                    title="찜 기능 준비 중"
                    aria-label={`${product.name} 찜 기능 준비 중`}
                  >
                    <Icon name="heart" size={19} />
                  </button>
                </div>
                {/* TODO: 공통 상품 상세 라우트가 생기면 storeProductId를 전달 */}
                <h3>{product.name}</h3>
                <strong className="product-price">
                  {product.price == null
                    ? '가격 정보 없음'
                    : `${product.price.toLocaleString('ko-KR')}원`}
                </strong>
                <span className={`stock-label ${product.purchasable ? '' : 'sold-out'}`}>
                  {product.stockLabel}
                </span>
                <AvailabilityBadges
                  pickup={product.pickupAvailable}
                  delivery={product.deliveryAvailable}
                />
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
      {/* TODO(search): 공용 결과 경로 확정 후 searchContext의 storeId, storeName을 전달하고 빈 검색어로 전체 판매상품 표시 */}
      <button
        className="product-view-all"
        disabled
        data-store-id={searchContext.storeId}
        data-store-name={searchContext.storeName}
        title="상품 전체보기 화면 준비 중"
      >
        상품 전체보기
      </button>
    </section>
  );
}
