import { useState } from 'react';
import ProductCard from '../../components/ProductCard.jsx';
import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import { formatPeriod } from './bannerPeriod.js';

const NOTICES = [
  '이 배너는 판매자가 게재한 광고예요.',
  '할인율과 재고는 매장 사정에 따라 변경될 수 있어요.',
  '재고는 실시간으로 달라질 수 있어 결제 시점에 다시 확인해 주세요.',
];

// 광고 배너의 "자세히 보기" 화면 (/ads/:bannerId)
export default function AdDetailPage({ ad, error, onBack, onRetry, onOpenProduct, onOpenStore, onShowStoreProducts }) {
  const [isStoreWished, setIsStoreWished] = useState(false);
  const store = ad?.store;
  const hasDiscount = (ad?.maxDiscountRate ?? 0) > 0;

  return (
    <DetailShell
      title="광고"
      ready={Boolean(ad)}
      error={error}
      onBack={onBack}
      onRetry={onRetry}
      hero={ad ? (
        <section className="bd__hero bd__hero--ad">
          <p className="bd__eyebrow">
            <span className="bd__ad-badge">AD</span>
            {store?.name}
          </p>
          <h2>{ad.title}</h2>
          <p className="bd__hero-desc">{formatPeriod(ad)}</p>
        </section>
      ) : null}
      footer={store ? (
        <>
          <button className="bd__btn bd__btn--secondary" type="button" onClick={() => onOpenStore(store.id)}>
            매장 보기
          </button>
          <button className="bd__btn" type="button" onClick={() => onShowStoreProducts(store.id)}>
            {hasDiscount ? '할인 상품 전체 보기' : '상품 전체 보기'}
          </button>
        </>
      ) : null}
    >
      {ad ? (
        <>
          {store ? (
            <DetailSection>
              <div className="bd__store-row">
                {store.imageUrl
                  ? <img className="bd__store-thumb" src={store.imageUrl} alt="" />
                  : <span className="bd__store-thumb" aria-hidden="true" />}
                <div className="bd__store-body">
                  <strong>
                    {store.name}
                    {store.pickupAvailable ? <span className="bd__badge">픽업 가능</span> : null}
                    {store.deliveryAvailable ? <span className="bd__badge">택배 가능</span> : null}
                  </strong>
                  <p className="bd__store-meta">{store.description ?? store.address}</p>
                </div>
                <button
                  className="bd__wish"
                  type="button"
                  aria-pressed={isStoreWished}
                  onClick={() => setIsStoreWished((current) => !current)}
                >
                  {isStoreWished ? '♥ 찜한 매장' : '♡ 매장 찜'}
                </button>
              </div>
            </DetailSection>
          ) : null}

          <DetailSection
            title={hasDiscount ? '할인 상품' : '광고 상품'}
            description={hasDiscount ? `최대 ${ad.maxDiscountRate}% 할인 중이에요` : `${ad.products.length}개의 상품이 있어요`}
          >
            {ad.products.length ? (
              <div className="bd__grid">
                {ad.products.map((product) => (
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

          <DetailSection title="유의사항">
            <NoticeList items={NOTICES} />
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
