// 장바구니 — 픽업 / 배달 탭 전환, 화면 하나 (C-01 · C-02 · C-03)
// 담당: 동균
// 장바구니는 재고를 잡지 않는다. 화면의 재고·가격은 조회할 때마다 서버가 다시 계산한 값이다.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../../api/cart.api.js';
import { isAuthError } from '../../api/wishlist.api.js';
import CartTabBar from './components/CartTabBar.jsx';
import CartStoreGroup from './components/CartStoreGroup.jsx';
import CartPriceBar from './components/CartPriceBar.jsx';
import CartOrderSummary from './components/CartOrderSummary.jsx';
import CartEmptyState, { CartLoginRequired } from './components/CartEmptyState.jsx';
import { listCheckoutCoupons } from '../my/account.api.js';
import { useSession } from '../my/hooks.js';
import { invalidCartCoupons, couponReasonMessage } from '../common/couponSafety.js';
import { CouponSheet, Sheet } from '../common/CheckoutParts.jsx';
import '../common/checkout.css';
import './CartPage.css';

const TYPES = ['PICKUP', 'DELIVERY'];

export default function CartPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = TYPES.includes(searchParams.get('type')) ? searchParams.get('type') : 'PICKUP';
  const [notice, setNotice] = useState('');
  const [couponSheet, setCouponSheet] = useState(null);
  const [couponAssignments, setCouponAssignments] = useState({});
  const { status: authStatus, session } = useSession();
  const accountKey = session?.user?.id ?? 'guest';
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['cart', 'list', type, accountKey],
    queryFn: () => cartApi.list(type),
    enabled: authStatus !== 'loading',
    refetchInterval: 30000,
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
  const selectedStores = (cart?.stores ?? []).filter((store) => store.itemsTotal > 0);
  const couponStore =
    couponSheet?.type === 'coupon'
      ? selectedStores.find((store) => store.storeId === couponSheet.storeId) ?? null
      : null;
  const couponQueries = useQueries({
    queries: selectedStores.map((store) => ({
      queryKey: ['cart', 'coupons', store.storeId, store.itemsTotal, store.deliveryFee, type, accountKey],
      queryFn: () =>
        listCheckoutCoupons({
          storeId: store.storeId,
          amount: store.itemsTotal,
          // 쿠폰은 멤버십 배달비 할인을 뺀 배송비를 기준으로 계산된다
          deliveryFee: type === 'PICKUP' ? 0 : Math.max((store.deliveryFee ?? 0) - (store.membershipDeliveryDiscount ?? 0), 0),
          fulfillmentType: type,
        }),
      enabled: type === 'PICKUP' || store.deliveryFee !== null,
      refetchInterval: 30000,
    })),
  });
  const couponResults = Object.fromEntries(
    selectedStores.map((store, index) => [store.storeId, couponQueries[index]]),
  );
  const couponQuery = couponStore ? couponResults[couponStore.storeId] : null;
  const invalidCouponKey = cart ? JSON.stringify(invalidCartCoupons(couponAssignments, cart.stores, couponResults)) : '[]';
  useEffect(() => {
    const invalid = JSON.parse(invalidCouponKey);
    if (!invalid.length) return undefined;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCouponAssignments((current) => {
        const next = { ...current };
        invalid.forEach((row) => { if (next[row.storeId]?.userCouponId === row.id) delete next[row.storeId]; });
        return next;
      });
      setNotice(couponReasonMessage(invalid[0].reason));
    });
    return () => { active = false; };
  }, [invalidCouponKey]);
  const activeCouponAssignments = Object.fromEntries(
    Object.entries(couponAssignments).flatMap(([storeId, assignment]) => {
      const current = couponResults[storeId]?.data?.items?.find((item) => item.id === assignment.userCouponId);
      return current?.usable ? [[storeId, { ...assignment, discountAmount: current.discountAmount }]] : [];
    }),
  );
  const couponDiscount = Object.values(activeCouponAssignments).reduce(
    (sum, assignment) => sum + assignment.discountAmount,
    0,
  );
  const payableAmount = Math.max((cart?.grandTotal ?? 0) - couponDiscount, 0);

  // 체크한 상품 중 지금 살 수 있는 것만 결제 화면으로 넘긴다 (결제 화면이 서버에서 다시 확인한다)
  const order = () => {
    const cartItemIds = availableItems.filter((item) => item.isSelected).map((item) => item.cartItemId);
    if (cartItemIds.length === 0) {
      setNotice('주문할 상품을 선택해 주세요');
      return;
    }
    navigate('/checkout', {
      state: {
        mode: 'CART',
        cartItemIds,
        couponAssignments: Object.fromEntries(
          Object.entries(activeCouponAssignments).map(([storeId, assignment]) => [
            storeId,
            assignment.userCouponId,
          ]),
        ),
      },
    });
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
                couponAssignment={activeCouponAssignments[store.storeId]}
                couponState={couponResults[store.storeId]?.isError ? 'error' : couponResults[store.storeId]?.isPending ? 'loading' : 'ready'}
                couponCount={
                  (couponResults[store.storeId]?.data?.items ?? []).filter((item) => item.usable)
                    .length
                }
                onCoupon={() => setCouponSheet({ type: 'coupon', storeId: store.storeId })}
                onToggle={(item, checked) =>
                  updateMutation.mutate([{ id: item.cartItemId, body: { isSelected: checked } }])
                }
                onQuantity={(item, quantity) => updateMutation.mutate([{ id: item.cartItemId, body: { quantity } }])}
                onRemove={(item) => removeMutation.mutate([item.cartItemId])}
              />
            ))}
            <CartOrderSummary
              cart={cart}
              type={type}
              couponDiscount={couponDiscount}
            />
          </>
        ) : (
          <CartEmptyState type={type} />
        )}
      </main>
      {cart && items.length > 0 && (
        <CartPriceBar
          type={type}
          selectedCount={cart.selectedCount}
          grandTotal={payableAmount}
          onOrder={order}
        />
      )}
      {couponStore && couponQuery?.data ? (
        <CouponSheet
          order={{
            store: { name: couponStore.storeName },
            itemsAmount: couponStore.itemsTotal,
            deliveryFee: type === 'PICKUP' ? 0 : Math.max((couponStore.deliveryFee ?? 0) - (couponStore.membershipDeliveryDiscount ?? 0), 0),
          }}
          option={{
            fulfillmentType: type,
            userCouponId: activeCouponAssignments[couponStore.storeId]?.userCouponId ?? null,
          }}
          coupons={couponQuery.data.items}
          takenIds={new Set(
            Object.entries(activeCouponAssignments)
              .filter(([storeId]) => storeId !== couponStore.storeId)
              .map(([, assignment]) => assignment.userCouponId),
          )}
          onClose={() => setCouponSheet(null)}
          onApply={(userCouponId) => {
            setCouponAssignments((current) => {
              const next = { ...current };
              if (!userCouponId) delete next[couponStore.storeId];
              else {
                const selected = couponQuery.data.items.find((item) => item.id === userCouponId);
                next[couponStore.storeId] = {
                  userCouponId,
                  discountAmount: selected?.discountAmount ?? 0,
                  couponName: selected?.coupon?.name ?? '적용한 쿠폰',
                  quoteKey: `${type}:${couponStore.itemsTotal}:${couponStore.deliveryFee ?? 0}`,
                };
              }
              return next;
            });
            setCouponSheet(null);
          }}
        />
      ) : null}
      {couponStore && couponQuery?.isPending ? (
        <Sheet title="쿠폰 선택" onClose={() => setCouponSheet(null)}>
          <p className="cart-coupon-state">사용 가능한 쿠폰을 불러오는 중이에요</p>
        </Sheet>
      ) : null}
      {couponStore && couponQuery?.isError ? (
        <Sheet title="쿠폰 선택" onClose={() => setCouponSheet(null)}>
          <p className="cart-coupon-state">쿠폰을 불러오지 못했어요</p>
          <button type="button" className="co-pay co-pay--sheet" onClick={() => couponQuery.refetch()}>
            다시 시도
          </button>
        </Sheet>
      ) : null}
      {notice && (
        <div className="cart-toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
