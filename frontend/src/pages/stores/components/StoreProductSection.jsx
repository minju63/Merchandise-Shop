import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../../api/store.api.js';
import GoodsListCard from '../../../components/GoodsListCard.jsx';
import { PageState } from './StoreShell.jsx';

export default function StoreProductSection({ storeId, searchContext }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-products', storeId, page],
    queryFn: () => storeApi.products(storeId, { sort: 'popular', page, size: 20 }),
  });
  const products = data?.data;
  return (
    <section className="product-section">
      <div className="section-heading">
        <strong>굿즈 <span>{products?.totalCount ?? 0}</span></strong>
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
