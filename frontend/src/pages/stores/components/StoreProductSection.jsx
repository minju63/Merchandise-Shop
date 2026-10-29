import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storeApi } from '../../../api/store.api.js';
import GoodsListCard from '../../../components/GoodsListCard.jsx';
import { PageState } from './StoreShell.jsx';

// 카테고리·검색 결과와 같은 정렬 목록
const SORT_OPTIONS = [
  ['popular', '인기순'],
  ['sales', '판매순'],
  ['newest', '최신순'],
  ['wishlist', '찜 많은 순'],
  ['stock', '재고 많은 순'],
  ['stock_asc', '재고 적은 순'],
  ['price_asc', '낮은 가격 순'],
  ['price_desc', '높은 가격 순'],
];

function ProductSortMenu({ sort, onChange }) {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!menu.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  return (
    <div className="store-sort" ref={menu}>
      <button type="button" aria-label="굿즈 정렬" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((current) => !current)}>
        {SORT_OPTIONS.find(([value]) => value === sort)?.[1] ?? '인기순'}
        <span className="sort-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="store-sort__menu" role="menu">
          {SORT_OPTIONS.map(([value, label]) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={sort === value}
              key={value}
              onClick={() => { onChange(value); setOpen(false); }}
            >
              {label}
              {sort === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StoreProductSection({ storeId, searchContext }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('popular');
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['store-products', storeId, sort, page],
    queryFn: () => storeApi.products(storeId, { sort, page, size: 20 }),
  });
  const products = data?.data;
  return (
    <section className="product-section">
      <div className="section-heading">
        <strong>굿즈 <span>{products?.totalCount ?? 0}</span></strong>
        <ProductSortMenu sort={sort} onChange={(value) => { setSort(value); setPage(1); }} />
      </div>
      <Link
        className="product-view-all"
        to={`/search/results?storeId=${encodeURIComponent(searchContext.storeId)}`}
      >
        굿즈 전체보기 ›
      </Link>
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
