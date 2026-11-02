import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../../api/store.api.js';
import GoodsListCard from '../../../components/GoodsListCard.jsx';
import { PageState } from './StoreShell.jsx';

export default function StoreProductSection({ storeId, searchContext }) {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-products', storeId, 1, 6],
    queryFn: () => storeApi.products(storeId, { sort: 'popular', page: 1, size: 6 }),
  });
  const products = data?.data;
  return (
    <section className="product-section">
      <div className="section-heading">
        <strong>굿즈 <span>{products?.totalCount ?? 0}</span></strong>
        <Link
          className="product-view-all"
          to={`/search/results?storeId=${encodeURIComponent(searchContext.storeId)}`}
          state={{ fromStoreDetail: true }}
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
          <div className="goods-grid">
            {products.items.map((product) => (
              <GoodsListCard
                key={product.storeProductId}
                item={{ ...product, storeId: searchContext.storeId, storeName: searchContext.storeName }}
                linkState={{ listReturnTo: `/stores/${encodeURIComponent(storeId)}` }}
              />
            ))}
          </div>
        </>
      ) : (
        <PageState>판매 중인 상품이 없습니다.</PageState>
      )}
    </section>
  );
}
