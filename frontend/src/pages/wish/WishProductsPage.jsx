// 찜한 상품 (J-01)
// 담당: 동균
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAuthError, wishlistApi } from '../../api/wishlist.api.js';
import { cartApi } from '../../api/cart.api.js';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import WishTabBar from './components/WishTabBar.jsx';
import WishProductCard from './components/WishProductCard.jsx';
import WishRemoveDialog from './components/WishRemoveDialog.jsx';
import FulfillmentSheet from './components/FulfillmentSheet.jsx';
import RestockAlertSheet from './components/RestockAlertSheet.jsx';
import WishEmptyState, { WishLoginRequired } from './components/WishEmptyState.jsx';
import './WishProductsPage.css';

const PAGE_SIZE = 20;

// POST /cart/items 409 사유별 안내
const addFailMessages = {
  UPCOMING: '아직 입고 전이에요. 사전예약으로 먼저 잡아두세요',
  OUT_OF_STOCK: '품절이에요. 재입고 알림을 받아보세요',
  FULFILLMENT_OFF: '이 매장은 해당 수령 방법을 지원하지 않아요',
  STORE_CLOSED: '지금 주문할 수 없는 매장이에요',
  NOT_ON_SALE: '판매하지 않는 상품이에요',
};

// POST /restock-alerts 409 사유별 안내
const alertFailMessages = {
  ALREADY_IN_STOCK: '지금 구매할 수 있는 상품이에요',
  STORE_CLOSED: '지금 주문할 수 없는 매장이에요',
  NOT_ON_SALE: '판매하지 않는 상품이에요',
};

export default function WishProductsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [sheetItem, setSheetItem] = useState(null);
  const [restockItem, setRestockItem] = useState(null);
  // 토스트: { text, duration, actionLabel?, onAction? }
  const [notice, setNotice] = useState(null);
  const toast = (text, options = {}) => setNotice({ text, duration: 2000, ...options });
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

  // 수량은 1로 고정해서 담는다. 수량 조절은 장바구니 화면에서 한다.
  const addMutation = useMutation({
    mutationFn: ({ item, fulfillmentType }) =>
      cartApi.addItem({ storeProductId: item.storeProductId, quantity: 1, fulfillmentType }),
    onSuccess: (response, { fulfillmentType }) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setSheetItem(null);
      const goToCart = () => navigate(`/cart?type=${fulfillmentType}`);
      if (response.data.capped) {
        toast(`1인 최대 ${response.data.quantity}개까지 담을 수 있어요`);
        setTimeout(goToCart, 1500);
      } else {
        goToCart();
      }
    },
    onError: (addError) => {
      setSheetItem(null);
      if (isAuthError(addError)) toast('로그인이 필요합니다');
      else toast(addFailMessages[addError.code] ?? '장바구니에 담지 못했어요. 다시 시도해 주세요');
    },
  });

  const refreshProducts = () => queryClient.invalidateQueries({ queryKey: ['wishlist', 'products'] });
  const alertRemoveMutation = useMutation({
    mutationFn: (storeProductId) => wishlistApi.restockAlerts.remove(storeProductId),
    onSuccess: async () => {
      await refreshProducts();
      toast('알림을 해제했어요');
    },
    onError: (alertError) => toast(isAuthError(alertError) ? '로그인이 필요합니다' : '알림을 해제하지 못했어요'),
  });
  const alertCreateMutation = useMutation({
    mutationFn: (storeProductId) => wishlistApi.restockAlerts.create(storeProductId),
    onSuccess: async (response, storeProductId) => {
      await refreshProducts();
      setRestockItem(null);
      toast('재입고되면 알려드릴게요', {
        duration: 3000,
        actionLabel: '취소',
        onAction: () => alertRemoveMutation.mutate(storeProductId),
      });
    },
    onError: (alertError) => {
      setRestockItem(null);
      if (isAuthError(alertError)) return toast('로그인이 필요합니다');
      if (alertError.code === 'ALREADY_IN_STOCK') refreshProducts();
      toast(alertFailMessages[alertError.code] ?? '알림을 신청하지 못했어요. 다시 시도해 주세요');
    },
  });
  const alertPendingId = alertCreateMutation.isPending
    ? alertCreateMutation.variables
    : alertRemoveMutation.isPending
      ? alertRemoveMutation.variables
      : null;

  // 신청된 알림은 시트 없이 바로 해제, 아니면 시트에서 매장을 확인하고 신청한다.
  const toggleRestockAlert = (item) => {
    if (item.restockAlertEnabled) alertRemoveMutation.mutate(item.storeProductId);
    else setRestockItem(item);
  };

  const addToCart = (item) => {
    if (item.pickupAvailable && item.deliveryAvailable) setSheetItem(item);
    else addMutation.mutate({ item, fulfillmentType: item.pickupAvailable ? 'PICKUP' : 'DELIVERY' });
  };

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), notice.duration);
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
                isAdding={addMutation.isPending && addMutation.variables?.item.storeProductId === item.storeProductId}
                onRemove={() => setTarget(item)}
                onAddToCart={() => addToCart(item)}
                isAlertPending={alertPendingId === item.storeProductId}
                onRestockAlert={() => toggleRestockAlert(item)}
                onPending={() => toast('준비 중입니다')}
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
      {sheetItem && (
        <FulfillmentSheet
          productName={sheetItem.productName}
          isPending={addMutation.isPending}
          onCancel={() => setSheetItem(null)}
          onSelect={(fulfillmentType) => addMutation.mutate({ item: sheetItem, fulfillmentType })}
        />
      )}
      {restockItem && (
        <RestockAlertSheet
          item={restockItem}
          isPending={alertCreateMutation.isPending}
          onCancel={() => setRestockItem(null)}
          onConfirm={() => alertCreateMutation.mutate(restockItem.storeProductId)}
        />
      )}
      {notice && (
        <div className="wish-toast" role="status">
          {notice.text}
          {notice.actionLabel && (
            <button
              type="button"
              className="wish-toast-action"
              onClick={() => {
                setNotice(null);
                notice.onAction();
              }}
            >
              {notice.actionLabel}
            </button>
          )}
        </div>
      )}
      <BottomNavigation />
    </div>
  );
}
