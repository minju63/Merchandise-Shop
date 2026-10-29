// 찜한 상품 (J-01)
// 담당: 동균
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAuthError, wishlistApi } from '../../api/wishlist.api.js';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import WishTabBar from './components/WishTabBar.jsx';
import WishProductCard from './components/WishProductCard.jsx';
import WishRemoveDialog from './components/WishRemoveDialog.jsx';
import WishEmptyState, { WishLoginRequired } from './components/WishEmptyState.jsx';
import './WishProductsPage.css';

const PAGE_SIZE = 20;

export default function WishProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const params = { page, size: PAGE_SIZE };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['wishlist', 'products', params],
    queryFn: () => wishlistApi.products(params),
    retry: (count, queryError) => !isAuthError(queryError) && count < 1,
  });
  const removeMutation = useMutation({
    mutationFn: (storeProductId) => wishlistApi.removeProduct(storeProductId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wishlist', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['wishlist', 'counts'] }),
      ]);
      setTarget(null);
    },
  });

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  const closeDialog = () => {
    setTarget(null);
    removeMutation.reset();
  };

  return (
    <div className="app-shell">
      <WishTabBar />
      <main className="wish-main">
        {isPending ? (
          <div className="wish-product-grid" aria-label="찜한 상품 불러오는 중">
            {[0, 1, 2, 3].map((n) => (
              <div key={n} className="wish-skeleton-card" />
            ))}
          </div>
        ) : isError ? (
          isAuthError(error) ? (
            <WishLoginRequired returnTo="/wish" />
          ) : (
            <div className="wish-state">
              <p>찜한 상품을 불러오지 못했습니다.</p>
              <button type="button" className="wish-state-button" onClick={() => refetch()}>
                다시 시도
              </button>
            </div>
          )
        ) : data.data.items.length ? (
          <div className="wish-product-grid">
            {data.data.items.map((item) => (
              <WishProductCard
                key={item.wishlistId}
                item={item}
                onRemove={() => setTarget(item)}
                onPending={() => setNotice('준비 중입니다')}
              />
            ))}
          </div>
        ) : (
          <WishEmptyState type="products" />
        )}
        <div className="wish-pagination">
          {page > 1 && (
            <button type="button" className="wish-state-button" onClick={() => setPage(page - 1)}>
              이전
            </button>
          )}
          {data?.data.totalCount > page * PAGE_SIZE && (
            <button type="button" className="wish-state-button" onClick={() => setPage(page + 1)}>
              다음
            </button>
          )}
        </div>
      </main>
      {target && (
        <WishRemoveDialog
          type="product"
          name={target.productName}
          isPending={removeMutation.isPending}
          isError={removeMutation.isError}
          onCancel={closeDialog}
          onConfirm={() => removeMutation.mutate(target.storeProductId)}
        />
      )}
      {notice && (
        <div className="wish-toast" role="status">
          {notice}
        </div>
      )}
      <BottomNavigation />
    </div>
  );
}
