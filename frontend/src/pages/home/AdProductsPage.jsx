import ProductCard from '../../components/ProductCard.jsx';
import { DetailSection, DetailShell } from './BannerDetailParts.jsx';

const SORTS = [
  { value: 'discount', label: '할인율순' },
  { value: 'price_asc', label: '낮은 가격순' },
  { value: 'price_desc', label: '높은 가격순' },
  { value: 'low_stock', label: '재고 적은 순' },
];

// 광고 배너의 "할인 상품 전체 보기" 화면 (/ads/:bannerId/products)
export default function AdProductsPage({ list, error, onBack, onRetry, onChangeSort, onOpenProduct, onOpenStore }) {
  const store = list?.store;
  const hasDiscount = (list?.maxDiscountRate ?? 0) > 0;

  return (
    <DetailShell
      title={hasDiscount ? '할인 상품' : '광고 상품'}
      ready={Boolean(list)}
      error={error}
      onBack={onBack}
      onRetry={onRetry}
      footer={store ? (
        <button className="bd__btn bd__btn--secondary" type="button" onClick={() => onOpenStore(store.id)}>
          {store.name} 매장 보기
        </button>
      ) : null}
    >
      {list ? (
        <DetailSection
          title={store ? `${store.name} ${hasDiscount ? '할인 상품' : '판매 상품'}` : '상품'}
          description={`총 ${list.totalCount}개${hasDiscount ? ` · 최대 ${list.maxDiscountRate}% 할인` : ''}`}
        >
          <div className="bd__chips" role="group" aria-label="정렬">
            {SORTS.map((sort) => (
              <button
                className="bd__chip"
                type="button"
                key={sort.value}
                aria-pressed={list.sort === sort.value}
                onClick={() => onChangeSort(sort.value)}
              >
                {sort.label}
              </button>
            ))}
          </div>
          {list.products.length ? (
            <div className="bd__grid">
              {list.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={onOpenProduct && product.storeProductId ? () => onOpenProduct(product) : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="bd__empty">판매 중인 상품을 준비 중이에요</p>
          )}
        </DetailSection>
      ) : null}
    </DetailShell>
  );
}
