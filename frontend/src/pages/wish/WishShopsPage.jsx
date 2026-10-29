// 찜한 굿즈샵 (J-02)
// 담당: 동균
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAuthError, wishlistApi } from '../../api/wishlist.api.js';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import WishTabBar from './components/WishTabBar.jsx';
import WishShopCard from './components/WishShopCard.jsx';
import WishRemoveDialog from './components/WishRemoveDialog.jsx';
import WishEmptyState, { WishLoginRequired } from './components/WishEmptyState.jsx';
// 탭 · 다이얼로그 · 빈 상태 등 찜 공통 스타일은 WishProductsPage.css 에 있다
import './WishProductsPage.css';
import './WishShopsPage.css';

const PAGE_SIZE = 20;

export default function WishShopsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const params = { page, size: PAGE_SIZE };
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['wishlist', 'shops', params],
    queryFn: () => wishlistApi.shops(params),
    retry: (count, queryError) => !isAuthError(queryError) && count < 1,
  });
  const removeMutation = useMutation({
    mutationFn: (storeId) => wishlistApi.removeShop(storeId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wishlist', 'shops'] }),
        queryClient.invalidateQueries({ queryKey: ['wishlist', 'counts'] }),
      ]);
      setTarget(null);
    },
  });

  const closeDialog = () => {
    setTarget(null);
    removeMutation.reset();
  };

  return (
    <div className="app-shell">
      <WishTabBar />
      <main className="wish-main">
        {isPending ? (
          <div className="wish-shop-list" aria-label="찜한 굿즈샵 불러오는 중">
            {[0, 1, 2].map((n) => (
              <div key={n} className="wish-skeleton-row" />
            ))}
          </div>
        ) : isError ? (
          isAuthError(error) ? (
            <WishLoginRequired returnTo="/wish/shops" />
          ) : (
            <div className="wish-state">
              <p>찜한 굿즈샵을 불러오지 못했습니다.</p>
              <button type="button" className="wish-state-button" onClick={() => refetch()}>
                다시 시도
              </button>
            </div>
          )
        ) : data.data.items.length ? (
          <div className="wish-shop-list">
            {data.data.items.map((shop) => (
              <WishShopCard key={shop.wishlistId} shop={shop} onRemove={() => setTarget(shop)} />
            ))}
          </div>
        ) : (
          <WishEmptyState type="shops" />
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
          type="shop"
          name={target.storeName}
          isPending={removeMutation.isPending}
          isError={removeMutation.isError}
          onCancel={closeDialog}
          onConfirm={() => removeMutation.mutate(target.storeId)}
        />
      )}
      <BottomNavigation />
    </div>
  );
}
