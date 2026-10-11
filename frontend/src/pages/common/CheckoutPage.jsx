import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listAddresses, listCoupons, listPaymentMethods } from '../my/account.api.js';
import { formatPhone, paymentMethodName } from '../my/accountFormat.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from '../my/common.jsx';
import { useRequest, useRequireLogin } from '../my/hooks.js';
import {
  BagIcon,
  ChevronIcon,
  ClockIcon,
  InfoIcon,
  PinIcon,
  StoreIcon,
  TruckIcon,
} from '../my/icons.jsx';
import { formatWon } from '../my/orderFormat.js';
import { MY_ROUTES } from '../my/routes.js';
import { Box } from './AuthParts.jsx';
import { CouponSheet, Radio, Sheet, StockSheet } from './CheckoutParts.jsx';
import { previewCheckout, submitCheckout } from './checkout.api.js';
import {
  DELIVERY_REQUESTS,
  issueText,
  kstClock,
  pickupDateOptions,
  shortAddress,
  stockIssueText,
} from './checkoutFormat.js';
import { AUTH_ROUTES } from './authRoutes.js';
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
    source = { mode: 'CART', cartItemIds: state.cartItemIds, fulfillmentType: null };
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

function StoreBlock({
  order,
  option,
  dates,
  texts,
  couponCount,
  onOption,
  onText,
  onPickCoupon,
  onPickAddress,
  navigate,
}) {
  const store = order.store;
  const isPickup = option.fulfillmentType === 'PICKUP';
  const isDelivery = option.fulfillmentType === 'DELIVERY';
  const address = order.address;
  const savedRequest = address?.delivery_request ?? '';
  const chip =
    texts.deliveryChip ??
    (DELIVERY_REQUESTS.includes(savedRequest) ? savedRequest : savedRequest ? CUSTOM : null);
  const customText = texts.delivery ?? (chip === CUSTOM ? savedRequest : '');
  const range = order.pickup?.availableIntervals ?? [];
  const fulfillmentIssues = order.issues.filter((code) => !code.startsWith('COUPON_'));

  return (
    <>
      <section className="co-section">
        <div className="co-store">
          <StoreIcon width={18} height={18} />
          <strong>{store.name}</strong>
          <span>{shortAddress(store.address)}</span>
        </div>
        {order.items.map((item) => (
          <div key={item.storeProductId} className="co-item">
            <Thumb src={item.thumbnailUrl} size={56} />
            <div className="co-item__text">
              <strong>{item.productName}</strong>
              <span>수량 {item.quantity}개</span>
            </div>
            <strong className="co-item__price">{formatWon(item.lineAmount)}</strong>
          </div>
        ))}
      </section>

      <section className="co-section">
        <h2 className="co-h">수령 방법</h2>
        <div className="co-seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={isPickup}
            className={isPickup ? 'is-on' : ''}
            disabled={!store.pickup_available}
            onClick={() => onOption({ fulfillmentType: 'PICKUP' })}
          >
            <StoreIcon width={16} height={16} /> 매장 픽업
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isDelivery}
            className={isDelivery ? 'is-on' : ''}
            disabled={!store.delivery_available}
            onClick={() => onOption({ fulfillmentType: 'DELIVERY' })}
          >
            <TruckIcon width={16} height={16} /> 배달
          </button>
        </div>

        {isPickup ? (
          <>
            <h3 className="co-sub">픽업 날짜</h3>
            <div className="co-chips">
              {dates.map((date) => (
                <button
                  key={date.value}
                  type="button"
                  className={option.pickupDate === date.value ? 'co-chip is-on' : 'co-chip'}
                  onClick={() => onOption({ pickupDate: date.value })}
                >
                  {date.label}
                </button>
              ))}
            </div>
            {range.length ? (
              <p className="co-info">
                <ClockIcon width={14} height={14} />
                픽업 가능 시간{' '}
                {range.map((r) => `${kstClock(r.startsAt)} – ${kstClock(r.endsAt)}`).join(', ')}
                {order.pickup?.prepareMinutes
                  ? ` · 상품 준비에 약 ${order.pickup.prepareMinutes}분 걸려요`
                  : ''}
              </p>
            ) : null}
          </>
        ) : null}

        {isDelivery ? (
          <>
            {address ? (
              <div className="co-addr">
                <div className="co-addr__top">
                  <strong>{address.label || '배송지'}</strong>
                  {address.is_default ? <span className="my-pill">기본 배송지</span> : null}
                  <button type="button" className="co-addr__change" onClick={onPickAddress}>
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
                    chip === label ? 'co-chip co-chip--round is-on' : 'co-chip co-chip--round'
                  }
                  onClick={() => onText({ deliveryChip: label })}
                >
                  {label}
                </button>
              ))}
            </div>
            {chip === CUSTOM ? (
              <input
                className="co-input"
                maxLength={100}
                placeholder="배달 요청사항을 입력해 주세요"
                value={customText}
                onChange={(event) => onText({ delivery: event.target.value })}
              />
            ) : null}
            {order.delivery ? (
              <p className="co-info">
                <TruckIcon width={14} height={14} />
                {order.delivery.courierName
                  ? `${order.delivery.courierName} 배송`
                  : '매장에서 직접 배달'}{' '}
                · 배달비 {formatWon(order.deliveryFee)}
              </p>
            ) : null}
          </>
        ) : null}

        {fulfillmentIssues.map((code) => (
          <p key={code} className="co-warn">
            {issueText(code)}
          </p>
        ))}
      </section>

      <section className="co-section">
        <h2 className="co-h">매장 요청사항</h2>
        <input
          className="co-input"
          maxLength={200}
          placeholder="예: 포장은 간단하게 해주세요"
          value={texts.store ?? ''}
          onChange={(event) => onText({ store: event.target.value })}
        />
      </section>

      <section className="co-section">
        <h2 className="co-h">할인</h2>
        <button type="button" className="co-coupon" onClick={onPickCoupon}>
          <div className="co-coupon__text">
            <strong>쿠폰</strong>
            <span>
              {order.coupon
                ? `${order.coupon.name}${order.coupon.usable ? '' : ' · 사용 불가'}`
                : `사용 가능 ${couponCount}장`}
            </span>
          </div>
          {order.discountAmount > 0 ? (
            <em className="co-coupon__amount">-{formatWon(order.discountAmount)}</em>
          ) : (
            <span className="co-coupon__pick">선택</span>
          )}
          <ChevronIcon width={16} height={16} />
        </button>
      </section>
    </>
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
  dates,
  couponCount,
  onOption,
  onPickCoupon,
  onPickDate,
}) {
  const store = order.store;
  const isPickup = option.fulfillmentType === 'PICKUP';
  const isDelivery = option.fulfillmentType === 'DELIVERY';
  const dateLabel = dates.find((date) => date.value === option.pickupDate)?.label ?? '';
  const range = order.pickup?.availableIntervals ?? [];
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
          disabled={!store.pickup_available}
          onClick={() => onOption({ fulfillmentType: 'PICKUP' })}
        >
          <StoreIcon width={14} height={14} /> 픽업
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isDelivery}
          className={isDelivery ? 'is-on' : ''}
          disabled={!store.delivery_available}
          onClick={() => onOption({ fulfillmentType: 'DELIVERY' })}
        >
          <TruckIcon width={14} height={14} /> 배달
        </button>
      </div>
      {isPickup ? (
        <button type="button" className="co-row" onClick={onPickDate}>
          <span>픽업 일시</span>
          <strong>{dateLabel}</strong>
          <ChevronIcon width={14} height={14} />
        </button>
      ) : null}
      {isPickup && range.length ? (
        <p className="co-info">
          <ClockIcon width={14} height={14} />
          픽업 가능 {range.map((r) => `${kstClock(r.startsAt)} – ${kstClock(r.endsAt)}`).join(', ')}
        </p>
      ) : null}
      {isDelivery && order.delivery ? (
        <p className="co-info">
          <PinIcon width={14} height={14} />
          아래 배송지로 배달돼요 · 배달비 {formatWon(order.deliveryFee)}
        </p>
      ) : null}
      {issues.map((code) => (
        <p key={code} className="co-warn">
          {issueText(code)}
        </p>
      ))}
      <button type="button" className="co-coupon co-coupon--card" onClick={onPickCoupon}>
        <div className="co-coupon__text">
          <strong>쿠폰</strong>
          <span>
            {order.coupon
              ? `${order.coupon.name}${order.coupon.usable ? '' : ' · 사용 불가'}`
              : `사용 가능 ${couponCount}장`}
          </span>
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
  const location = useLocation();
  const signedIn = useRequireLogin(AUTH_ROUTES.login);
  const [source, setSource] = useState(() => readSource(location.state));
  const [now] = useState(() => new Date());
  const dates = useMemo(() => pickupDateOptions(now), [now]);

  const [known, setKnown] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [texts, setTexts] = useState({});
  const [addressId, setAddressId] = useState(null);
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [agree, setAgree] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const coupons = useRequest(signedIn, 'checkout-coupons', listCoupons);
  const methods = useRequest(signedIn, 'checkout-methods', listPaymentMethods);
  const addresses = useRequest(
    signedIn && sheet?.type === 'address',
    'checkout-addresses',
    listAddresses,
  );

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
    ...(paymentMethodId ? { paymentMethodId } : {}),
  };
  const key = signedIn && previewBody ? `${attempt}:${JSON.stringify(previewBody)}` : null;

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    const body = JSON.parse(key.slice(key.indexOf(':') + 1));
    previewCheckout(body).then(
      (data) => {
        if (!active) return;
        setResult({ key, data, error: null });
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
      (cause) => active && setResult({ key, data: null, error: cause }),
    );
    return () => {
      active = false;
    };
  }, [key, source, dates]);

  if (!source)
    return (
      <main className="co-page">
        <PageHeader title="주문 / 결제" />
        <p className="ord-empty">주문할 상품이 없어요</p>
        <div className="co-footer">
          <button type="button" className="co-pay" onClick={() => navigate(AUTH_ROUTES.home)}>
            쇼핑하러 가기
          </button>
        </div>
      </main>
    );

  const data = result?.data ?? null;
  const loading = !result || result.key !== key;
  const setOption = (storeId) => (patch) =>
    setOverrides((prev) => ({ ...prev, [storeId]: { ...prev[storeId], ...patch } }));
  const setText = (storeId) => (patch) =>
    setTexts((prev) => ({ ...prev, [storeId]: { ...prev[storeId], ...patch } }));

  const availableCoupons = (coupons.data?.items ?? []).filter(
    (item) => item.effectiveStatus === 'AVAILABLE',
  );
  const usedElsewhere = (storeId) =>
    new Set(
      (known ?? [])
        .filter((entry) => entry.storeId !== storeId)
        .map((entry) => overrides[entry.storeId]?.userCouponId)
        .filter(Boolean),
    );

  const multi = Boolean(data) && data.orders.length > 1;
  const quantity = data
    ? data.orders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0), 0)
    : 0;
  const totals = data?.totals;
  const stockIssues = data?.stockIssues ?? [];
  const blockers = data
    ? [
        ...stockIssues.map(stockIssueText),
        ...(data.paymentMethod ? [] : ['결제수단을 등록해 주세요']),
      ]
    : [];
  const canPay = Boolean(data?.canSubmit) && agree && !loading && !busy;
  const deliveryOrders = data
    ? data.orders
        .map((order, index) => ({ order, index }))
        .filter(({ order }) => order.fulfillmentType === 'DELIVERY')
    : [];
  const sharedAddress = deliveryOrders.find(({ order }) => order.address)?.order.address ?? null;
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
    setBusy(true);
    setError('');
    try {
      const done = await submitCheckout({
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
      });
      saveSource(null);
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
      setAttempt((value) => value + 1);
    } finally {
      setBusy(false);
    }
  };

  const paymentList = (
    <>
      {(methods.data?.items ?? []).map((method) => (
        <Radio
          key={method.id}
          checked={data?.paymentMethod?.id === method.id}
          onSelect={() => {
            setPaymentMethodId(method.id);
            setSheet(null);
          }}
        >
          <strong>{paymentMethodName(method)}</strong>
          {method.is_default ? <span>기본 결제수단</span> : null}
        </Radio>
      ))}
      {methods.data && methods.data.items.length === 0 ? (
        <p className="co-warn">등록된 결제수단이 없어요</p>
      ) : null}
    </>
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
      <div className="co-sum__total">
        <dt>최종 결제 금액</dt>
        <dd>{totals.totalAmount === null ? '-' : formatWon(totals.totalAmount)}</dd>
      </div>
    </dl>
  ) : null;

  let body;
  if (result?.error && !data)
    body = <ErrorNotice error={result.error} onRetry={() => setAttempt((v) => v + 1)} />;
  else if (!data || !known) body = <Loading />;
  else if (multi)
    body = (
      <div className={loading ? 'co-body is-loading' : 'co-body'}>
        <div className="co-banner">
          <span className="co-banner__icon">
            <BagIcon width={20} height={20} />
          </span>
          <div>
            <strong>{data.orders.length}개 매장 상품을 주문해요</strong>
            <span>매장별로 주문이 나뉘어 {data.orders.length}건으로 접수돼요</span>
          </div>
        </div>
        {data.orders.map((order, index) => {
          const entry = known.find((item) => item.storeId === order.storeId);
          return (
            <OrderCard
              key={order.storeId}
              order={order}
              option={optionOf(entry)}
              index={index}
              dates={dates}
              couponCount={availableCoupons.length}
              onOption={setOption(order.storeId)}
              onPickCoupon={() => setSheet({ type: 'coupon', storeId: order.storeId })}
              onPickDate={() => setSheet({ type: 'date', storeId: order.storeId })}
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
          </section>
        ) : null}

        <section className="co-section">
          <h2 className="co-h">결제수단</h2>
          {data.paymentMethod ? (
            <button type="button" className="co-pm" onClick={() => setSheet({ type: 'payment' })}>
              <div className="co-coupon__text">
                <strong>{paymentMethodName(data.paymentMethod)}</strong>
                {data.paymentMethod.is_default ? <span>기본 결제수단</span> : null}
              </div>
              <span className="co-coupon__pick">변경</span>
              <ChevronIcon width={14} height={14} />
            </button>
          ) : (
            <p className="co-warn">등록된 결제수단이 없어요</p>
          )}
        </section>

        <section className="co-section">
          <h2 className="co-h">결제 금액</h2>
          {totalRows}
          {agreeBlock}
        </section>
      </div>
    );
  else
    body = (
      <div className={loading ? 'co-body is-loading' : 'co-body'}>
        <section className="co-section co-section--first">
          <h2 className="co-h co-h--big">주문 상품 {quantity}개</h2>
        </section>
        {data.orders.map((order) => {
          const entry = known.find((item) => item.storeId === order.storeId);
          return (
            <StoreBlock
              key={order.storeId}
              order={order}
              option={optionOf(entry)}
              dates={dates}
              texts={texts[order.storeId] ?? {}}
              couponCount={availableCoupons.length}
              onOption={setOption(order.storeId)}
              onText={setText(order.storeId)}
              onPickCoupon={() => setSheet({ type: 'coupon', storeId: order.storeId })}
              onPickAddress={() => setSheet({ type: 'address' })}
              navigate={navigate}
            />
          );
        })}

        <section className="co-section">
          <div className="co-h-row">
            <h2 className="co-h">결제수단</h2>
            <button type="button" onClick={() => navigate(MY_ROUTES.paymentMethods)}>
              관리 <ChevronIcon width={12} height={12} />
            </button>
          </div>
          {paymentList}
        </section>

        <section className="co-section">
          <h2 className="co-h">결제 금액</h2>
          {totalRows}
          {agreeBlock}
        </section>
      </div>
    );

  const couponOrder =
    sheet?.type === 'coupon' ? data?.orders.find((order) => order.storeId === sheet.storeId) : null;
  const dateEntry =
    sheet?.type === 'date' ? known?.find((entry) => entry.storeId === sheet.storeId) : null;

  return (
    <main className="co-page">
      <PageHeader title="주문 / 결제" />
      {body}
      {error ? <p className="co-warn co-warn--footer">{error}</p> : null}
      <div className="co-footer">
        <button type="button" className="co-pay" disabled={!canPay} onClick={pay}>
          {totals?.totalAmount != null
            ? `${formatWon(totals.totalAmount)} 결제하기${multi ? ` · 주문 ${data.orders.length}건` : ''}`
            : '결제하기'}
        </button>
      </div>

      {couponOrder ? (
        <CouponSheet
          order={couponOrder}
          option={optionOf(known.find((entry) => entry.storeId === sheet.storeId))}
          coupons={availableCoupons}
          takenIds={usedElsewhere(sheet.storeId)}
          onClose={() => setSheet(null)}
          onApply={(id) => {
            setOption(sheet.storeId)({ userCouponId: id });
            setSheet(null);
          }}
        />
      ) : null}

      {dateEntry ? (
        <Sheet title="픽업 날짜" onClose={() => setSheet(null)}>
          {dates.map((date) => (
            <Radio
              key={date.value}
              checked={optionOf(dateEntry).pickupDate === date.value}
              onSelect={() => {
                setOption(sheet.storeId)({ pickupDate: date.value });
                setSheet(null);
              }}
            >
              <strong>{date.label}</strong>
            </Radio>
          ))}
        </Sheet>
      ) : null}

      {sheet?.type === 'payment' ? (
        <Sheet title="결제수단 선택" onClose={() => setSheet(null)}>
          {paymentList}
        </Sheet>
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
