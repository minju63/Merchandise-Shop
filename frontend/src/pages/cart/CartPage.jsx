// 장바구니 — 픽업 / 배달 탭 전환, 화면 하나 (C-01 · C-02 · C-03)
// 담당: 동균
// 장바구니는 재고를 잡지 않는다. 화면의 재고·가격은 조회할 때마다 서버가 다시 계산한 값이다.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../../api/cart.api.js';
import { isAuthError } from '../../api/wishlist.api.js';
import CartTabBar from './components/CartTabBar.jsx';
import CartStoreGroup from './components/CartStoreGroup.jsx';
import CartPriceBar from './components/CartPriceBar.jsx';
import CartEmptyState, { CartLoginRequired } from './components/CartEmptyState.jsx';
import './CartPage.css';

const TYPES = ['PICKUP', 'DELIVERY'];

export default function CartPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = TYPES.includes(searchParams.get('type')) ? searchParams.get('type') : 'PICKUP';
  const [notice, setNotice] = useState('');
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['cart', 'list', type],
    queryFn: () => cartApi.list(type),
    retry: (count, queryError) => !isAuthError(queryError) && count < 1,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cart'] });
  const showError = () => setNotice('변경하지 못했어요. 다시 시도해 주세요');

  const updateMutation = useMutation({
    mutationFn: (changes) => Promise.all(changes.map(({ id, body }) => cartApi.updateItem(id, body))),
    onSuccess: (responses) => {
      if (responses.some((response) => response.data.capped))
        setNotice(`1인 최대 ${responses.find((response) => response.data.capped).data.quantity}개까지 담을 수 있어요`);
      return refresh();
    },
    onError: showError,
  });
  const removeMutation = useMutation({
    mutationFn: (ids) => cartApi.removeItems(ids),
    onSuccess: refresh,
    onError: showError,
  });

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  const cart = data?.data;
  const items = cart?.stores.flatMap((store) => store.items) ?? [];
  const availableItems = items.filter((item) => item.available);
  const selectedIds = items.filter((item) => item.isSelected).map((item) => item.cartItemId);
  const soldOutIds = items.filter((item) => item.unavailableReason === 'OUT_OF_STOCK').map((item) => item.cartItemId);
  const allSelected = availableItems.length > 0 && availableItems.every((item) => item.isSelected);
  const busy = updateMutation.isPending || removeMutation.isPending;

  // 체크한 상품 중 지금 살 수 있는 것만 결제 화면으로 넘긴다 (결제 화면이 서버에서 다시 확인한다)
  const order = () => {
    const cartItemIds = availableItems.filter((item) => item.isSelected).map((item) => item.cartItemId);
    if (cartItemIds.length === 0) {
      setNotice('주문할 상품을 선택해 주세요');
      return;
    }
    navigate('/checkout', { state: { mode: 'CART', cartItemIds } });
  };

  const toggleAll = () =>
    updateMutation.mutate(
      availableItems
        .filter((item) => item.isSelected === allSelected)
        .map((item) => ({ id: item.cartItemId, body: { isSelected: !allSelected } })),
    );

  return (
    <div className="app-shell cart-shell">
      <CartTabBar type={type} />
      <main className="cart-main">
        {isPending ? (
          <div className="cart-skeleton" aria-label="장바구니 불러오는 중">
            {[0, 1].map((n) => (
              <div key={n} />
            ))}
          </div>
        ) : isError ? (
          isAuthError(error) ? (
            <CartLoginRequired returnTo={`/cart?type=${type}`} />
          ) : (
            <div className="cart-state">
              <p>장바구니를 불러오지 못했습니다.</p>
              <button type="button" className="cart-state-button" onClick={() => refetch()}>
                다시 시도
              </button>
            </div>
          )
        ) : items.length ? (
          <>
            {type === 'PICKUP' && <p className="cart-notice">픽업은 배송비가 없습니다.</p>}
            <div className="cart-toolbar">
              <label className="cart-select-all">
                <input
                  type="checkbox"
                  className="cart-check"
                  checked={allSelected}
                  disabled={busy || availableItems.length === 0}
                  onChange={toggleAll}
                />
                전체 선택 ({selectedIds.length}/{availableItems.length})
              </label>
              <div className="cart-toolbar-actions">
                <button
                  type="button"
                  className="cart-remove-selected"
                  disabled={busy || soldOutIds.length === 0}
                  onClick={() => removeMutation.mutate(soldOutIds)}
                >
                  품절 삭제
                </button>
                <button
                  type="button"
                  className="cart-remove-selected"
                  disabled={busy || selectedIds.length === 0}
                  onClick={() => removeMutation.mutate(selectedIds)}
                >
                  선택 삭제
                </button>
              </div>
            </div>
            {cart.stores.map((store) => (
              <CartStoreGroup
                key={store.storeId}
                store={store}
                type={type}
                disabled={busy}
                onToggle={(item, checked) =>
                  updateMutation.mutate([{ id: item.cartItemId, body: { isSelected: checked } }])
                }
                onQuantity={(item, quantity) => updateMutation.mutate([{ id: item.cartItemId, body: { quantity } }])}
                onRemove={(item) => removeMutation.mutate([item.cartItemId])}
              />
            ))}
          </>
        ) : (
          <CartEmptyState type={type} />
        )}
      </main>
      {cart && items.length > 0 && (
        <CartPriceBar
          type={type}
          selectedCount={cart.selectedCount}
          grandTotal={cart.grandTotal}
          onOrder={order}
        />
      )}
      {notice && (
        <div className="cart-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
