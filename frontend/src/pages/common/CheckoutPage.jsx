import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { listAddresses, listCoupons, listPaymentMethods } from '../my/account.api.js';
import { formatPhone } from '../my/accountFormat.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from '../my/common.jsx';
import { useRequest, useRequireLogin, useSession } from '../my/hooks.js';
import {
  BagIcon,
  ChevronIcon,
  InfoIcon,
  StoreIcon,
  TruckIcon,
} from '../my/icons.jsx';
import { formatWon } from '../my/orderFormat.js';
import { MY_ROUTES } from '../my/routes.js';
import { Box } from '../auth/AuthParts.jsx';
import { CouponSheet, Radio, Sheet, StockSheet } from './CheckoutParts.jsx';
import { PaymentMethodSheet } from '../fan/PaymentMethodPicker.jsx';
import { selectedPaymentName } from '../fan/paymentMethodPickerFormat.js';
import { previewCheckout, submitCheckout, hasPendingCheckout, recoverPendingCheckout } from './checkout.api.js';
import { COUPON_MESSAGES, invalidCheckoutCoupons, couponReasonMessage } from './couponSafety.js';
import {
  DELIVERY_REQUESTS,
  issueText,
  pickupDateOptions,
  stockIssueText,
} from './checkoutFormat.js';
import { AUTH_ROUTES } from '../auth/authRoutes.js';
import '../my/my.css';
import '../my/orders.css';
import './checkout.css';

const SOURCE_KEY = 'goodspang:checkout-source';
const CUSTOM = '직접 입력';

// 주문할 상품은 이동할 때 state로 받고, 새로고침에 대비해 sessionStorage에도 둔다.
//   { mode: 'DIRECT', items: [{ storeProductId, quantity }] }  — 바로 구매
//   { mode: 'CART', cartItemIds: [...] }                        — 장바구니 주문
//   { reorder: { items: [...] } }                               — 마이의 다시 주문
function saveSource(source) {
  try {
    if (source) sessionStorage.setItem(SOURCE_KEY, JSON.stringify(source));
    else sessionStorage.removeItem(SOURCE_KEY);
  } catch {
    // 저장소를 못 써도 화면은 동작한다.
  }
}

function readSource(state) {
  let source = null;
  if (state?.reorder?.items?.length) {
    source = {
      mode: 'DIRECT',
      items: state.reorder.items.map((item) => ({
        storeProductId: item.storeProductId,
        quantity: item.quantity,
      })),
      fulfillmentType: state.reorder.items[0].fulfillmentType ?? null,
    };
  } else if (state?.mode === 'DIRECT' && state.items?.length) {
    source = { mode: 'DIRECT', items: state.items, fulfillmentType: state.fulfillmentType ?? null };
  } else if (state?.mode === 'CART' && state.cartItemIds?.length) {
    source = {
      mode: 'CART',
      cartItemIds: state.cartItemIds,
      fulfillmentType: null,
      ...(state.couponAssignments && typeof state.couponAssignments === 'object'
        ? { couponAssignments: state.couponAssignments }
        : {}),
    };
  }
  if (source) saveSource(source);
  else {
    try {
      source = JSON.parse(sessionStorage.getItem(SOURCE_KEY) ?? 'null');
    } catch {
      source = null;
    }
  }
  return source;
}

function PickupNotice({ storeName }) {
  return (
    <ul className="co-pickup-notice">
      <li>바코드는 영업일 기준 최대 24시간 이내 발송됩니다.</li>
      <li>바코드를 수신 받으신 이후 ‘{storeName}’으로 방문해주세요.</li>
      <li>바코드 수신 후 3일 이내 매장에 방문하지 않으실 경우 주문은 자동 취소됩니다.</li>
    </ul>
  );
}

function CouponTitle({ onInfo }) {
  return (
    <div className="co-coupon-title">
      <strong>장바구니 쿠폰</strong>
      <button type="button" aria-label="장바구니 쿠폰 안내" onClick={onInfo}>
        <InfoIcon width={18} height={18} />
      </button>
    </div>
  );
}

function AddressCard({ address, onChange }) {
  return (
    <div className="co-addr">
      <div className="co-addr__top">
        <strong>{address.label || '배송지'}</strong>
        {address.is_default ? <span className="my-pill">기본 배송지</span> : null}
        <button type="button" className="co-addr__change" onClick={onChange}>
          변경
        </button>
      </div>
      <p>
        {address.recipient_name} · {formatPhone(address.recipient_phone)}
      </p>
      <p>
        ({address.zip_code}) {address.road_address} {address.detail_address}
      </p>
    </div>
  );
}

// 장바구니 결제(C-04)에서 매장별 주문을 보여 주는 카드
function OrderCard({
  order,
  option,
  index,
  couponCount,
  couponState,
  onPickCoupon,
}) {
  const store = order.store;
  const isPickup = option.fulfillmentType === 'PICKUP';
  const isDelivery = option.fulfillmentType === 'DELIVERY';
  const issues = order.issues.filter((code) => !code.startsWith('COUPON_'));

  return (
    <section className="co-card">
      <div className="co-card__head">
        <span className="co-tag">주문 {index + 1}</span>
        <strong>{store.name}</strong>
      </div>
      {order.items.map((item) => (
        <div key={item.storeProductId} className="co-item">
          <Thumb src={item.thumbnailUrl} size={48} />
          <div className="co-item__text">
            <strong>{item.productName}</strong>
            <span>수량 {item.quantity}개</span>
          </div>
          <strong className="co-item__price">{formatWon(item.lineAmount)}</strong>
        </div>
      ))}
      <div className="co-seg co-seg--small" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={isPickup}
          className={isPickup ? 'is-on' : ''}
          disabled
        >
          <StoreIcon width={14} height={14} /> 픽업
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isDelivery}
          className={isDelivery ? 'is-on' : ''}
          disabled
        >
          <TruckIcon width={14} height={14} /> 배달
        </button>
      </div>
      {isPickup ? <PickupNotice storeName={store.name} /> : null}
      {issues.map((code) => (
        <p key={code} className="co-warn">
          {issueText(code)}
        </p>
      ))}
      <div className="co-coupon-title"><strong>상품 쿠폰</strong></div>
      <button type="button" className="co-coupon co-coupon--card" onClick={onPickCoupon}>
        <div className="co-coupon__text">
          <strong>
            {order.coupon
              ? `${order.coupon.name}${order.coupon.usable ? '' : ' · 사용 불가'}`
              : couponState === 'error' ? '쿠폰 조회 실패 · 다시 시도' : couponState === 'loading' ? '쿠폰 불러오는 중' : `사용 가능 ${couponCount}장`}
          </strong>
          <span>{order.coupon ? '상품 쿠폰 적용 중' : '쿠폰을 선택해 주세요'}</span>
        </div>
        {order.discountAmount > 0 ? (
          <em className="co-coupon__amount">-{formatWon(order.discountAmount)}</em>
        ) : (
          <span className="co-coupon__pick">선택</span>
        )}
        <ChevronIcon width={14} height={14} />
      </button>
      <dl className="co-sum co-sum--card">
        <div>
          <dt>상품 금액</dt>
          <dd>{formatWon(order.itemsAmount)}</dd>
        </div>
        <div>
          <dt>쿠폰 할인</dt>
          <dd className={order.discountAmount ? 'is-discount' : ''}>
            {order.discountAmount ? `-${formatWon(order.discountAmount)}` : '0원'}
          </dd>
        </div>
        {isDelivery ? (
          <div>
            <dt>배달비</dt>
            <dd>{order.deliveryFee === null ? '-' : formatWon(order.deliveryFee)}</dd>
          </div>
        ) : null}
        <div className="co-sum__total">
          <dt>주문 {index + 1} 결제 금액</dt>
          <dd>{order.totalAmount === null ? '-' : formatWon(order.totalAmount)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const signedIn = useRequireLogin(AUTH_ROUTES.login);
  const [source, setSource] = useState(() => readSource(location.state));
  const [now] = useState(() => new Date());
  const dates = useMemo(() => pickupDateOptions(now), [now]);

  const [known, setKnown] = useState(null);
  const [overrides, setOverrides] = useState(() =>
    Object.fromEntries(
      Object.entries(source?.couponAssignments ?? {}).map(([storeId, userCouponId]) => [
        storeId,
        { userCouponId },
      ]),
    ),
  );
  const [texts, setTexts] = useState({});
  const [addressId, setAddressId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [paymentOption, setPaymentOption] = useState(null);
  const [cartCouponId, setCartCouponId] = useState(null);
  const [agree, setAgree] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const payLock = useRef(false);
  const request = useRef(null);
  const lastQuotedAmount = useRef(null);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pointsInput, setPointsInput] = useState('');
  const [pointsUse, setPointsUse] = useState(0);
  const [useExpected, setUseExpected] = useState(false);

  const { session } = useSession();
  const accountId = session?.user.id;
  const coupons = useRequest(signedIn, `checkout-coupons:${session?.user.id ?? ''}`, listCoupons);
  const methods = useRequest(signedIn, `checkout-methods:${accountId}`, listPaymentMethods);
  const addresses = useRequest(
    signedIn && sheet?.type === 'address',
    `checkout-addresses:${accountId}`,
    listAddresses,
  );
  const paymentMethods = methods.data?.items ?? [];
  const bankAccounts = paymentMethods.filter((method) => method.method_type === 'BANK_ACCOUNT');
  const defaultAccount = bankAccounts.find((method) => method.is_default) ?? null;
  const selectedPaymentOption = paymentOption ?? (defaultAccount ? 'GOODSPICK_PAY' : null);
  const selectedPaymentMethodId =
    selectedPaymentOption === 'GOODSPICK_PAY'
      ? bankAccounts.find((method) => method.id === paymentMethodId)?.id ?? defaultAccount?.id ?? null
      : null;

  const optionOf = (entry) => ({ ...entry, ...overrides[entry.storeId] });

  const base = source
    ? source.mode === 'CART'
      ? { mode: 'CART', cartItemIds: source.cartItemIds }
      : { mode: 'DIRECT', items: source.items }
    : null;

  const previewBody = base && {
    ...base,
    ...(known
      ? {
          storeOptions: known.map((entry) => {
            const option = optionOf(entry);
            return {
              storeId: option.storeId,
              fulfillmentType: option.fulfillmentType,
              ...(option.fulfillmentType === 'PICKUP' ? { pickupDate: option.pickupDate } : {}),
              ...(option.userCouponId ? { userCouponId: option.userCouponId } : {}),
            };
          }),
        }
      : {}),
    ...(addressId ? { addressId } : {}),
    ...(selectedPaymentMethodId ? { paymentMethodId: selectedPaymentMethodId } : {}),
    ...(selectedPaymentOption ? { paymentOption: selectedPaymentOption } : {}),
    ...(cartCouponId ? { cartCouponId } : {}),
    ...(pointsUse > 0 ? { pointsUse } : {}),
    ...(useExpected ? { useExpectedPoints: true } : {}),
  };
  const key = signedIn && previewBody ? `${attempt}:${JSON.stringify(previewBody)}` : null;

  useEffect(() => {
    if (!accountId) return undefined;
    let active = true;
    Promise.resolve().then(async () => {
      if (!active || !hasPendingCheckout(accountId)) return;
      setRecoveryPending(true); setAgree(false); setRecovering(true);
      try {
        const done = await recoverPendingCheckout(accountId);
        if (active && done) {
          saveSource(null);
          window.dispatchEvent(new Event('coupons-changed'));
          void queryClient.invalidateQueries({ queryKey: ['cart'] });
          navigate(AUTH_ROUTES.checkoutComplete(done.checkoutGroupId), { replace: true, state: { result: done } });
        }
      } catch (cause) { if (active) setError(cause.message); }
      finally { if (active) setRecovering(false); }
    });
    return () => { active = false; };
  }, [accountId, navigate, queryClient]);

  const retryPending = async () => {
    if (payLock.current || !accountId) return;
    payLock.current = true; setRecovering(true);
    try {
      const done = await recoverPendingCheckout(accountId, true);
      if (!done) return;
      saveSource(null);
      window.dispatchEvent(new Event('coupons-changed'));
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate(AUTH_ROUTES.checkoutComplete(done.checkoutGroupId), { replace: true, state: { result: done } });
    } catch (cause) { setError(cause.message); }
    finally { payLock.current = false; setRecovering(false); }
  };

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const body = JSON.parse(key.slice(key.indexOf(':') + 1));
    previewCheckout(body).then(
      (data) => {
        if (!active) return;
        const invalid = invalidCheckoutCoupons(data);
        if (invalid.length) {
          setOverrides((current) => {
            const next = { ...current };
            invalid.filter((row) => row.storeId).forEach((row) => { next[row.storeId] = { ...next[row.storeId], userCouponId: null }; });
            return next;
          });
          if (invalid.some((row) => !row.storeId)) setCartCouponId(null);
          setAgree(false);
          setError(couponReasonMessage(invalid[0].reason));
        }
        if (lastQuotedAmount.current !== null && lastQuotedAmount.current !== data.totals.payAmount) setAgree(false);
        lastQuotedAmount.current = data.totals.payAmount;
        setResult({ key, accountId, data, error: null });
        setKnown(
          (prev) =>
            prev ??
            data.orders.map((order) => {
              const { store } = order;
              const hint = source?.fulfillmentType;
              const usable = (type) =>
                store[type === 'PICKUP' ? 'pickup_available' : 'delivery_available'];
              const fulfillmentType =
                order.fulfillmentType ??
                (hint && usable(hint) ? hint : store.pickup_available ? 'PICKUP' : 'DELIVERY');
              return { storeId: order.storeId, fulfillmentType, pickupDate: dates[0].value };
            }),
        );
      },
      (cause) => {
        if (!active) return;
        if (cause.code === 'COUPON_NOT_FOUND') {
          setOverrides((current) => Object.fromEntries(Object.entries(current).map(([storeId, option]) => [storeId, { ...option, userCouponId: null }])));
          setCartCouponId(null); setAgree(false); setError(COUPON_MESSAGES.COUPON_NOT_OWNED);
        }
        setResult({ key, accountId, data: null, error: cause });
      },
    );
    return () => {
      active = false;
    };
  }, [key, source, dates, accountId]);

  useEffect(() => {
    if (!signedIn || recoveryPending || busy) return undefined;
    const refresh = () => setAttempt((value) => value + 1);
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [signedIn, recoveryPending, busy]);

  if (!source)
    return (
      <main className="co-page">
        <PageHeader title="주문 / 결제" />
        <p className="ord-empty">주문할 상품이 없어요</p>
        {recoveryPending && <><p className="co-warn">{error || '이전 주문 처리 결과를 확인하고 있습니다.'}</p><button type="button" className="co-pay co-pay--ghost" disabled={recovering} onClick={retryPending}>이전 주문 상태 다시 확인</button></>}
        <div className="co-footer">
          <button type="button" className="co-pay" onClick={() => navigate(AUTH_ROUTES.home)}>
            쇼핑하러 가기
          </button>
        </div>
      </main>
    );

  const data = result && result.accountId === accountId ? result.data : null;
  const loading = !result || result.key !== key || result.accountId !== accountId;
  const setOption = (storeId) => (patch) =>
    setOverrides((prev) => ({ ...prev, [storeId]: { ...prev[storeId], ...patch } }));
  const setText = (storeId) => (patch) =>
    setTexts((prev) => ({ ...prev, [storeId]: { ...prev[storeId], ...patch } }));

  const availableCoupons = (coupons.data?.items ?? []).filter(
    (item) => item.effectiveStatus === 'AVAILABLE',
  );
  const productCoupons = availableCoupons.filter(
    (item) => Boolean(item.coupon.store?.id ?? item.coupon.store_id),
  );
  const cartCoupons = availableCoupons.filter(
    (item) => !(item.coupon.store?.id ?? item.coupon.store_id),
  );
  const productCouponsFor = (storeId) =>
    productCoupons.filter(
      (item) => (item.coupon.store?.id ?? item.coupon.store_id) === storeId,
    );
  const usedElsewhere = (storeId) =>
    new Set(
      (known ?? [])
        .filter((entry) => entry.storeId !== storeId)
        .map((entry) => overrides[entry.storeId]?.userCouponId)
        .filter(Boolean),
    );

  const multi = Boolean(data) && data.orders.length > 1;
  const totals = data?.totals;
  const points = data?.points;
  const applyPoints = (amount) => {
    const value = Math.max(0, Math.floor(Number(amount) || 0));
    setPointsInput(value ? String(value) : '');
    setPointsUse(value);
  };
  const pointIssue = (data?.issues ?? []).find((code) => code.startsWith('POINTS_'));
  const pointIssueText = {
    POINTS_MIN_BALANCE: `보유 적립금이 ${points?.minUse?.toLocaleString() ?? '1,000'}원 이상일 때 사용할 수 있어요`,
    POINTS_EXCEED_BALANCE: '보유 적립금보다 많이 사용할 수 없어요',
    POINTS_EXCEED_PAYABLE: '결제 금액보다 많이 사용할 수 없어요',
  }[pointIssue];
  const stockIssues = data?.stockIssues ?? [];
  const blockers = data
    ? [
        ...stockIssues.map(stockIssueText),
        ...(selectedPaymentOption ? [] : ['결제수단을 선택해 주세요']),
      ]
    : [];
  const canPay =
    Boolean(data?.canSubmit) && Boolean(selectedPaymentOption) && agree && !loading && !busy && !recoveryPending && !recovering;
  const deliveryOrders = data
    ? data.orders
        .map((order, index) => ({ order, index }))
        .filter(({ order }) => order.fulfillmentType === 'DELIVERY')
    : [];
  const sharedAddress = deliveryOrders.find(({ order }) => order.address)?.order.address ?? null;
  // 배달 요청사항은 배송지와 함께 모든 배달 주문에 똑같이 적용한다.
  const deliveryTexts = texts[deliveryOrders[0]?.order.storeId] ?? {};
  const savedRequest = sharedAddress?.delivery_request ?? '';
  const requestChip =
    deliveryTexts.deliveryChip ??
    (DELIVERY_REQUESTS.includes(savedRequest) ? savedRequest : savedRequest ? CUSTOM : null);
  const requestText = deliveryTexts.delivery ?? (requestChip === CUSTOM ? savedRequest : '');
  const setDeliveryText = (patch) =>
    deliveryOrders.forEach(({ order }) => setText(order.storeId)(patch));
  const thumbs = Object.fromEntries(
    (data?.orders ?? []).flatMap((order) =>
      order.items.map((item) => [item.storeProductId, item.thumbnailUrl]),
    ),
  );

  const goBackToCart = () => navigate(source.mode === 'CART' ? MY_ROUTES.cart : -1);

  // 재고가 모자란 상품을 빼고 남은 상품으로 다시 계산한다.
  const dropStockIssues = () => {
    const dropped = new Set(stockIssues.map((issue) => issue.storeProductId));
    let next;
    if (source.mode === 'CART') {
      const removeIds = new Set(
        data.orders.flatMap((order) =>
          order.items
            .filter((item) => dropped.has(item.storeProductId))
            .flatMap((i) => i.cartItemIds),
        ),
      );
      next = { ...source, cartItemIds: source.cartItemIds.filter((id) => !removeIds.has(id)) };
      if (!next.cartItemIds.length) return goBackToCart();
    } else {
      next = { ...source, items: source.items.filter((item) => !dropped.has(item.storeProductId)) };
      if (!next.items.length) return goBackToCart();
    }
    saveSource(next);
    setSource(next);
    setKnown(null);
    setOverrides({});
    setResult(null);
    return undefined;
  };

  const pay = async () => {
    if (payLock.current || !canPay) return;
    payLock.current = true;
    setBusy(true);
    setError('');
    try {
      const body = {
        ...previewBody,
        storeOptions: (previewBody.storeOptions ?? []).map((option) => {
          const text = texts[option.storeId] ?? {};
          const chip = text.deliveryChip;
          const delivery = chip === CUSTOM ? text.delivery : chip;
          return {
            ...option,
            ...(text.store ? { storeRequest: text.store } : {}),
            ...(option.fulfillmentType === 'DELIVERY' && delivery !== undefined
              ? { deliveryRequest: delivery }
              : {}),
          };
        }),
        paymentAgreed: true,
        confirmationToken: data.confirmationToken,
      };
      const fingerprint = JSON.stringify(body);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const done = await submitCheckout(body, request.current.id);
      window.dispatchEvent(new Event('coupons-changed'));
      saveSource(null);
      await queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate(AUTH_ROUTES.checkoutComplete(done.checkoutGroupId), {
        replace: true,
        state: {
          result: done,
          storeNames: Object.fromEntries(
            data.orders.map((order) => [order.storeId, order.store.name]),
          ),
        },
      });
    } catch (cause) {
      setError(cause.message);
      setAgree(false);
      if (cause.pending) setRecoveryPending(true);
      else if (cause.code?.startsWith('COUPON_') && COUPON_MESSAGES[cause.code]) {
        const invalidId = cause.details?.userCouponId;
        setOverrides((current) => Object.fromEntries(Object.entries(current).map(([storeId, option]) => [storeId,
          !invalidId || option.userCouponId === invalidId ? { ...option, userCouponId: null } : option])));
        if (!invalidId || cartCouponId === invalidId) setCartCouponId(null);
        setError(COUPON_MESSAGES[cause.code] ?? cause.message);
        coupons.reload();
      }
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      setAttempt((value) => value + 1);
    } finally {
      payLock.current = false;
      setBusy(false);
    }
  };

  const paymentBlock = (
    <section className="co-section">
      <h2 className="co-h">결제수단</h2>
      <div className={selectedPaymentOption ? 'fan-payment-summary is-selected' : 'fan-payment-summary'}>
        <span className="fan-payment-summary__icon" aria-hidden="true">₩</span>
        <div>
          <strong>
            {selectedPaymentName(selectedPaymentOption, selectedPaymentMethodId, bankAccounts)}
          </strong>
          <small>
            {selectedPaymentOption && totals?.payAmount != null
              ? `${formatWon(totals.payAmount)} 결제 예정`
              : '결제 전에 수단을 선택해 주세요'}
          </small>
        </div>
        <button type="button" onClick={() => setSheet({ type: 'paymentMethod' })}>
          {selectedPaymentOption ? '변경' : '선택'}
        </button>
      </div>
    </section>
  );

  const cartCouponBlock = (
    <section className="co-section">
      <CouponTitle onInfo={() => setSheet({ type: 'couponInfo' })} />
      <button type="button" className="co-coupon" onClick={() => setSheet({ type: 'cartCoupon' })}>
        <div className="co-coupon__text">
          <strong>
            {data?.cartCoupon
              ? `${data.cartCoupon.name}${data.cartCoupon.usable ? '' : ' · 사용 불가'}`
              : `사용 가능 ${cartCoupons.length}장`}
          </strong>
          <span>
            {data?.cartCoupon?.usable
              ? '장바구니 쿠폰 적용 중'
              : '전체 주문에 적용할 쿠폰을 선택해 주세요'}
          </span>
        </div>
        {totals?.cartCouponDiscountAmount > 0 ? (
          <em className="co-coupon__amount">-{formatWon(totals.cartCouponDiscountAmount)}</em>
        ) : (
          <span className="co-coupon__pick">선택</span>
        )}
        <ChevronIcon width={16} height={16} />
      </button>
    </section>
  );

  const agreeBlock = (
    <>
      <label className="co-agree">
        <Box checked={agree} onChange={setAgree} label="결제 동의" />
        <span>주문 내용을 확인했으며 결제에 동의합니다 (필수)</span>
      </label>
      <p className="co-info">
        <InfoIcon width={14} height={14} />
        시연용 결제로 실제 금액이 빠져나가지 않아요
      </p>
      {blockers.map((text) => (
        <p key={text} className="co-warn">
          {text}
        </p>
      ))}
    </>
  );

  const pointsBlock = points ? (
    <section className="co-section">
      <h2 className="co-h">적립금</h2>
      <p className="co-pts__balance">
        보유 <strong>{formatWon(points.balance)}</strong>
        <span>{points.minUse.toLocaleString()}원부터 사용할 수 있어요</span>
      </p>
      <div className="co-pts__row">
        <input
          className="co-input"
          inputMode="numeric"
          placeholder="사용할 금액"
          value={pointsInput}
          onChange={(event) => setPointsInput(event.target.value.replace(/\D/g, ''))}
        />
        <button type="button" className="co-pts__btn" onClick={() => applyPoints(pointsInput)}>
          적용
        </button>
        <button
          type="button"
          className="co-pts__btn"
          onClick={() => applyPoints(Math.min(points.balance, totals?.totalAmount ?? 0))}
        >
          전액
        </button>
      </div>
      <label className="co-pts__toggle">
        <Box
          checked={useExpected}
          onChange={setUseExpected}
          label="적립예정금 바로 사용"
        />
        <span>
          이번 주문 적립예정금 {formatWon(points.expectedAmount)} 바로 사용하기
        </span>
      </label>
      <p className="co-info">
        <InfoIcon width={14} height={14} />
        {useExpected
          ? '지금 사용하면 이번 주문은 추가 적립이 없어요'
          : `쓰지 않으면 구매 확정 후 ${formatWon(points.earnAmount)}이 적립돼요 (결제금액의 ${points.earnRatePercent}%)`}
      </p>
      {pointIssueText ? <p className="co-warn">{pointIssueText}</p> : null}
    </section>
  ) : null;

  const totalRows = totals ? (
    <dl className="co-sum">
      <div>
        <dt>{multi ? '총 상품 금액' : '상품 금액'}</dt>
        <dd>{formatWon(totals.itemsAmount)}</dd>
      </div>
      <div>
        <dt>{multi ? '총 쿠폰 할인' : '쿠폰 할인'}</dt>
        <dd className={totals.discountAmount ? 'is-discount' : ''}>
          {totals.discountAmount ? `-${formatWon(totals.discountAmount)}` : '0원'}
        </dd>
      </div>
      <div>
        <dt>배달비</dt>
        <dd>{totals.deliveryFee === null ? '-' : formatWon(totals.deliveryFee)}</dd>
      </div>
      {totals.pointsUsedAmount ? (
        <div>
          <dt>적립금 사용</dt>
          <dd className="is-discount">-{formatWon(totals.pointsUsedAmount)}</dd>
        </div>
      ) : null}
      <div className="co-sum__total">
        <dt>최종 결제 금액</dt>
        <dd>{totals.payAmount == null ? '-' : formatWon(totals.payAmount)}</dd>
      </div>
    </dl>
  ) : null;

  let body;
  if (result?.error && !data)
    body = <ErrorNotice error={result.error} onRetry={() => setAttempt((v) => v + 1)} />;
  else if (!data || !known) body = <Loading />;
  else
    body = (
      <div className={loading || recoveryPending ? 'co-body is-loading' : 'co-body'} inert={recoveryPending}>
        {multi ? (
        <div className="co-banner">
          <span className="co-banner__icon">
            <BagIcon width={20} height={20} />
          </span>
          <div>
            <strong>{data.orders.length}개 매장 상품을 주문해요</strong>
            <span>매장별로 주문이 나뉘어 {data.orders.length}건으로 접수돼요</span>
          </div>
        </div>
        ) : null}
        {data.orders.map((order, index) => {
          const entry = known.find((item) => item.storeId === order.storeId);
          return (
            <OrderCard
              key={order.storeId}
              order={order}
              option={optionOf(entry)}
              index={index}
              couponCount={productCouponsFor(order.storeId).length}
              couponState={coupons.error ? 'error' : coupons.loading ? 'loading' : 'ready'}
              onPickCoupon={() => setSheet({ type: 'coupon', storeId: order.storeId })}
            />
          );
        })}

        {deliveryOrders.length ? (
          <section className="co-section">
            <div className="co-h-row">
              <h2 className="co-h">배송지</h2>
              <span className="co-faint">
                주문 {deliveryOrders.map(({ index }) => index + 1).join(', ')}에 적용
              </span>
            </div>
            {sharedAddress ? (
              <AddressCard address={sharedAddress} onChange={() => setSheet({ type: 'address' })} />
            ) : (
              <button
                type="button"
                className="co-addr co-addr--empty"
                onClick={() => navigate(MY_ROUTES.addressNew)}
              >
                배송지를 등록해 주세요
              </button>
            )}
            <h3 className="co-sub">배달 요청사항</h3>
            <div className="co-chips">
              {[...DELIVERY_REQUESTS, CUSTOM].map((label) => (
                <button
                  key={label}
                  type="button"
                  className={
                    requestChip === label ? 'co-chip co-chip--round is-on' : 'co-chip co-chip--round'
                  }
                  onClick={() => setDeliveryText({ deliveryChip: label })}
                >
                  {label}
                </button>
              ))}
            </div>
            {requestChip === CUSTOM ? (
              <input
                className="co-input"
                maxLength={100}
                placeholder="배달 요청사항을 입력해 주세요"
                value={requestText}
                onChange={(event) => setDeliveryText({ delivery: event.target.value })}
              />
            ) : null}
          </section>
        ) : null}

        {pointsBlock}
        {cartCouponBlock}
        {paymentBlock}
        <section className="co-section">
          <h2 className="co-h">결제 금액</h2>
          {totalRows}
          {agreeBlock}
        </section>
      </div>
    );
  const couponOrder =
    sheet?.type === 'coupon' ? data?.orders.find((order) => order.storeId === sheet.storeId) : null;

  return (
    <main className="co-page">
      <PageHeader title="주문 / 결제" />
      {body}
      {error ? <p className="co-warn co-warn--footer">{error}</p> : null}
      {recoveryPending && <button type="button" className="co-pay co-pay--ghost" disabled={recovering} onClick={retryPending}>{recovering ? '주문 상태 확인 중…' : '이전 주문 상태 다시 확인'}</button>}
      <div className="co-footer">
        <button type="button" className="co-pay" disabled={!canPay} onClick={pay}>
          {totals?.payAmount != null
            ? `${formatWon(totals.payAmount)} 결제하기${multi ? ` · 주문 ${data.orders.length}건` : ''}`
            : '결제하기'}
        </button>
      </div>

      {['coupon', 'cartCoupon'].includes(sheet?.type) && (coupons.error || coupons.loading) ? <Sheet title="쿠폰 선택" onClose={() => setSheet(null)}>
        {coupons.error ? <ErrorNotice error={coupons.error} onRetry={coupons.reload} /> : <Loading />}
      </Sheet> : null}
      {couponOrder && !coupons.error && !coupons.loading ? (
        <CouponSheet
          order={couponOrder}
          option={optionOf(known.find((entry) => entry.storeId === sheet.storeId))}
          coupons={productCouponsFor(couponOrder.storeId)}
          takenIds={usedElsewhere(sheet.storeId)}
          onClose={() => setSheet(null)}
          onApply={(id) => {
            setOption(sheet.storeId)({ userCouponId: id });
            setSheet(null);
          }}
        />
      ) : null}

      {sheet?.type === 'cartCoupon' && data && !coupons.error && !coupons.loading ? (
        <CouponSheet
          order={{
            store: { name: '전체 주문' },
            itemsAmount: totals?.itemsAmount ?? 0,
            deliveryFee: totals?.deliveryFee ?? 0,
          }}
          option={{
            fulfillmentType:
              data.orders.every((order) => order.fulfillmentType === 'DELIVERY')
                ? 'DELIVERY'
                : 'PICKUP',
            userCouponId: cartCouponId,
          }}
          coupons={cartCoupons}
          takenIds={new Set(
            Object.values(overrides).map((option) => option.userCouponId).filter(Boolean),
          )}
          onClose={() => setSheet(null)}
          onApply={(id) => {
            setCartCouponId(id);
            setSheet(null);
          }}
        />
      ) : null}

      {sheet?.type === 'couponInfo' ? (
        <Sheet title="장바구니 쿠폰 안내" showClose onClose={() => setSheet(null)}>
          <ul className="co-coupon-guide">
            <li>장바구니 쿠폰은 상품 쿠폰과 중복 사용할 수 있어요.</li>
            <li>상품 쿠폰을 적용하면 장바구니 쿠폰 할인 금액이 달라질 수 있어요.</li>
            <li>일부 상품에는 장바구니 쿠폰을 사용할 수 없어요.</li>
            <li>
              구매 후 일부 상품을 취소하거나 반품하여 쿠폰 사용 조건을 충족하지 못하면 해당
              쿠폰 혜택이 회수될 수 있어요.
            </li>
          </ul>
        </Sheet>
      ) : null}

      {sheet?.type === 'paymentMethod' ? (
        <PaymentMethodSheet
          currentOption={selectedPaymentOption}
          currentMethodId={selectedPaymentMethodId}
          methods={methods.data ? bankAccounts : undefined}
          onAdd={() => navigate(MY_ROUTES.paymentMethods)}
          onClose={() => setSheet(null)}
          onConfirm={(option, methodId) => {
            setPaymentOption(option);
            setPaymentMethodId(methodId);
            setAgree(false);
          }}
        />
      ) : null}

      {sheet?.type === 'address' ? (
        <Sheet title="배송지 선택" onClose={() => setSheet(null)}>
          {addresses.error ? (
            <ErrorNotice error={addresses.error} onRetry={addresses.reload} />
          ) : null}
          {!addresses.data && !addresses.error ? <Loading /> : null}
          {(addresses.data?.items ?? []).map((item) => (
            <Radio
              key={item.id}
              checked={
                (addressId ??
                  sharedAddress?.id ??
                  data?.orders.find((o) => o.address)?.address?.id) === item.id
              }
              onSelect={() => {
                setAddressId(item.id);
                setSheet(null);
              }}
            >
              <strong>
                {item.label || '배송지'} · {item.recipient_name}
              </strong>
              <span>
                ({item.zip_code}) {item.road_address} {item.detail_address}
              </span>
            </Radio>
          ))}
          <button
            type="button"
            className="ord-btn ord-btn--block"
            onClick={() => navigate(MY_ROUTES.addressNew)}
          >
            새 배송지 추가
          </button>
        </Sheet>
      ) : null}

      {stockIssues.length && !loading ? (
        <StockSheet
          issues={stockIssues}
          thumbs={thumbs}
          canContinue={
            source.mode === 'CART'
              ? data.orders.some((order) =>
                  order.items.some(
                    (item) => !stockIssues.some((i) => i.storeProductId === item.storeProductId),
                  ),
                )
              : source.items.some(
                  (item) => !stockIssues.some((i) => i.storeProductId === item.storeProductId),
                )
          }
          onContinue={dropStockIssues}
          onBack={goBackToCart}
        />
      ) : null}
    </main>
  );
}
