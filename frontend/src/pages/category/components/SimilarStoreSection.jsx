import { Link } from 'react-router-dom';
import { useRef } from 'react';
import Icon from '../../stores/components/Icon.jsx';
import ProductEmptyState from './ProductEmptyState';
import useWishlist from '../../../hooks/useWishlist.js';
import useDragScroll from '../../../hooks/useDragScroll.js';

// 지금 보는 상품과 같거나 비슷한 상품을 재고 있게 파는 다른 굿즈샵 추천
export default function SimilarStoreSection({ storeProductId, productName, stores: storeList, loading, error, onRetry }) {
  const wish = useWishlist();
  const stores = storeList ?? [];
  const railRef = useRef(null);
  useDragScroll(railRef, !loading && !error && stores.length > 1);
  return (
    <section className="category-section category-similar-stores">
      <div className="category-similar-heading">
        <h2>비슷한 상품을 취급하는 다른 굿즈샵</h2>
        {stores.length > 0 && (
          <Link to={`/search/results?${new URLSearchParams({ tab: 'shops', similarTo: storeProductId })}`} aria-label={`${productName} 관련 굿즈샵 전체보기`}>
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
        <ul ref={railRef} className={stores.length > 1 ? 'slide' : ''}>
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
              <button
                type="button"
                className={`category-similar-heart${wish.isShopWished(store.id) ? ' is-wished' : ''}`}
                aria-pressed={wish.isShopWished(store.id)}
                aria-label={wish.isShopWished(store.id) ? `${store.name} 찜 해제` : `${store.name} 찜하기`}
                onClick={() => wish.toggleShop(store.id)}
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
