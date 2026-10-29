import { Link } from 'react-router-dom';
import Icon from '../../stores/components/Icon.jsx';
import ProductEmptyState from './ProductEmptyState';

// 지금 보는 상품과 같거나 비슷한 상품을 재고 있게 파는 다른 굿즈샵 추천
export default function SimilarStoreSection({ storeProductId, productName, stores: storeList, loading, error, onRetry }) {
  const stores = storeList ?? [];
  return (
    <section className="category-section category-similar-stores">
      <div className="category-similar-heading">
        <h2>비슷한 상품을 취급하는 다른 굿즈샵</h2>
        {stores.length > 0 && (
          <Link to={`/search/results?${new URLSearchParams({ q: productName, tab: 'shops', similarTo: storeProductId })}`}>
            전체보기 ›
          </Link>
        )}
      </div>
      {loading ? (
        <p role="status">굿즈샵을 불러오는 중입니다.</p>
      ) : error ? (
        <ProductEmptyState message="굿즈샵을 불러오지 못했습니다." onRetry={onRetry} />
      ) : stores.length === 0 ? (
        <ProductEmptyState message="비슷한 상품을 취급하는 다른 굿즈샵이 아직 없습니다." />
      ) : (
        <ul className={stores.length > 1 ? 'slide' : ''}>
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                to={
                  store.products[0]
                    ? `/products/${encodeURIComponent(store.products[0].storeProductId)}`
                    : `/stores/${encodeURIComponent(store.id)}`
                }
              >
                <div className="category-seller-thumbnail" aria-hidden="true">
                  ⌂
                  {store.thumbnailUrl && (
                    <img
                      src={store.thumbnailUrl}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  )}
                </div>
                <div className="category-similar-body">
                  <h3>
                    {store.name}
                    <span className={store.hasSameProduct ? 'same' : ''}>
                      {store.hasSameProduct ? '같은 상품 보유' : `비슷한 상품 ${store.matchedCount}개`}
                    </span>
                  </h3>
                  <p className="category-similar-region">
                    <Icon name="pin" size={13} />
                    {store.region || store.address}
                  </p>
                  <p className="category-similar-products">
                    {store.products.map((item) => item.name).join(' · ')}
                  </p>
                </div>
                <span aria-hidden="true">›</span>
              </Link>
              {/* 굿즈샵 탭 카드와 같이 찜 기능 연결 전까지 비활성 */}
              <button
                type="button"
                className="category-similar-heart"
                disabled
                title="찜 기능 준비 중"
                aria-label={`${store.name} 찜 기능 준비 중`}
              >
                <Icon name="heart" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
