import { useEffect, useRef, useState } from 'react';
import { couponConditions, formatMonthDot } from '../my/accountFormat.js';
import { Thumb } from '../my/common.jsx';
import { InfoIcon } from '../my/icons.jsx';
import { formatWon } from '../my/orderFormat.js';
import { estimateCoupon } from './checkoutFormat.js';

export function Sheet({ title, sub, showClose = false, onClose, children }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keydown = (event) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        const focusable = [...dialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, select, a[href], [tabindex="0"]')];
        const first = focusable[0], last = focusable.at(-1);
        if (!focusable.length) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      previous?.focus();
    };
  }, []);
  const drag = useRef(null);
  const dragY = useRef(0);
  const [offsetY, setOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finishDrag = (event, cancelled = false) => {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const shouldClose = !cancelled && dragY.current >= Math.min(120, window.innerHeight * 0.15);
    drag.current = null;
    dragY.current = 0;
    setDragging(false);
    if (shouldClose) onClose();
    else setOffsetY(0);
  };

  return (
    <div className="ord-sheet-backdrop" onClick={onClose}>
      <div
        className={`ord-sheet co-sheet${dragging ? ' is-dragging' : ''}`}
        role="dialog"
        aria-modal="true"
        ref={dialog}
        tabIndex={-1}
        aria-label={title}
        style={{ transform: `translateY(${offsetY}px)` }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="ord-sheet__grip"
          aria-label="바텀시트 닫기"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => {
            drag.current = { pointerId: event.pointerId, startY: event.clientY };
            dragY.current = 0;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current || event.pointerId !== drag.current.pointerId) return;
            const next = Math.max(0, event.clientY - drag.current.startY);
            dragY.current = next;
            setOffsetY(next);
          }}
          onPointerUp={(event) => finishDrag(event)}
          onPointerCancel={(event) => finishDrag(event, true)}
        />
        {title || showClose ? (
          <div className="co-sheet__heading">
            {title ? <h2 className="ord-sheet__title">{title}</h2> : null}
            {showClose ? (
              <button type="button" className="co-sheet__close" aria-label="닫기" onClick={onClose}>
                ×
              </button>
            ) : null}
          </div>
        ) : null}
        {sub ? <p className="ord-sheet__sub">{sub}</p> : null}
        <div className="co-sheet__body">{children}</div>
      </div>
    </div>
  );
}

export function Radio({ checked, disabled = false, onSelect, children }) {
  return (
    <label className={`co-radio${disabled ? ' is-off' : ''}`}>
      <input type="radio" checked={checked} disabled={disabled} onChange={onSelect} />
      <span className="co-radio__dot" />
      <span className="co-radio__text">{children}</span>
    </label>
  );
}

// C-02 쿠폰 선택
export function CouponSheet({ order, option, coupons, takenIds, onApply, onClose }) {
  const [draft, setDraft] = useState(option.userCouponId ?? null);
  const ctx = {
    itemsAmount: order.itemsAmount,
    deliveryFee: order.deliveryFee,
    fulfillmentType: option.fulfillmentType,
  };
  const rows = coupons.map((item) => {
    const estimate = estimateCoupon(item, ctx);
    const serverEvaluated = typeof item.usable === 'boolean';
    return {
      item,
      taken: takenIds.has(item.id),
      usable: serverEvaluated ? item.usable : estimate.usable,
      reason: serverEvaluated
        ? item.reason
          ? ({ MIN_ORDER_AMOUNT: `${formatWon(item.coupon.min_order_amount)} 이상 구매 시 사용 가능`, EXPIRED: '유효기간이 만료됐어요', USED: '이미 사용한 쿠폰이에요', STORE_MISMATCH: '다른 매장 쿠폰이에요', NOT_STARTED: '사용 기간 전이에요', FULFILLMENT_MISMATCH: '수령 방법이 맞지 않아요', FIRST_ORDER_ONLY: '첫 주문 전용 쿠폰이에요' }[item.reason] ?? '이 주문에는 사용할 수 없어요')
          : null
        : estimate.reason,
      amount: serverEvaluated ? item.discountAmount : estimate.amount,
    };
  });
  const best = rows
    .filter((row) => row.usable && !row.taken)
    .reduce((top, row) => (!top || row.amount > top.amount ? row : top), null);
  const picked = rows.find((row) => row.item.id === draft);
  const label = option.fulfillmentType === 'DELIVERY' ? '배달' : '픽업';

  return (
    <Sheet
      title="쿠폰 선택"
      sub={`${order.store.name} · 주문 금액 ${formatWon(order.itemsAmount)} · ${label}`}
      onClose={onClose}
    >
      <label className={draft === null ? 'co-cpn is-on' : 'co-cpn'}>
        <input type="radio" checked={draft === null} onChange={() => setDraft(null)} />
        <span className="co-radio__dot" />
        <span className="co-cpn__text">
          <strong>적용 안 함</strong>
          <span>쿠폰을 쓰지 않아요</span>
        </span>
        <strong className="co-cpn__amount">0원</strong>
      </label>
      {rows.map((row) => {
        const off = !row.usable || row.taken;
        return (
          <label
            key={row.item.id}
            className={`co-cpn${draft === row.item.id ? ' is-on' : ''}${off ? ' is-off' : ''}`}
          >
            <input
              type="radio"
              checked={draft === row.item.id}
              disabled={off}
              onChange={() => setDraft(row.item.id)}
            />
            <span className="co-radio__dot" />
            <span className="co-cpn__text">
              <strong>
                {row.item.coupon.name}
                {best?.item.id === row.item.id && rows.filter((r) => r.usable).length > 1 ? (
                  <em className="co-cpn__badge">최대 할인</em>
                ) : null}
              </strong>
              <span>
                {couponConditions(row.item)} · {formatMonthDot(row.item.effectiveExpiresAt)}까지
              </span>
              {row.taken ? <span className="co-cpn__reason">다른 주문에 쓰고 있어요</span> : null}
              {!row.taken && row.reason ? (
                <span className="co-cpn__reason">{row.reason}</span>
              ) : null}
            </span>
            <strong className="co-cpn__amount">{off ? '-' : `-${formatWon(row.amount)}`}</strong>
          </label>
        );
      })}
      {rows.length === 0 ? <p className="co-warn">사용 가능한 쿠폰이 없어요</p> : null}
      <button type="button" className="co-pay co-pay--sheet" disabled={draft !== null && (!picked?.usable || picked.taken)} onClick={() => onApply(draft)}>
        {picked ? `${formatWon(picked.amount)} 할인 적용` : '쿠폰 없이 진행'}
      </button>
    </Sheet>
  );
}

const STOCK_PILL = {
  NOT_ON_SALE: '판매 중지',
  NOT_OPEN_YET: '판매 전',
  INSUFFICIENT_STOCK: '재고 부족',
  MAX_PER_ORDER: '수량 초과',
};

// C-03 재고 부족
export function StockSheet({ issues, thumbs, canContinue, onContinue, onBack }) {
  return (
    <div className="ord-sheet-backdrop">
      <div className="ord-sheet co-sheet co-stock" role="alertdialog" aria-label="재고가 부족해요">
        <span className="ord-sheet__grip" />
        <span className="co-stock__icon">
          <InfoIcon width={28} height={28} />
        </span>
        <h2 className="co-stock__title">재고가 부족해요</h2>
        <p className="co-stock__desc">
          결제하는 동안 다른 손님이 먼저 구매했어요.
          <br />
          아래 상품을 확인해 주세요.
        </p>
        <div className="co-stock__list">
          {issues.map((issue) => (
            <div key={issue.storeProductId} className="co-stock__row">
              <Thumb src={thumbs[issue.storeProductId]} size={48} />
              <div className="co-item__text">
                <strong>{issue.productName}</strong>
                <span>
                  주문 {issue.requestedQuantity}개 · 남은 재고 {issue.availableQuantity}개
                </span>
              </div>
              <span className="co-stock__pill">
                {issue.reason === 'INSUFFICIENT_STOCK' && issue.availableQuantity === 0
                  ? '품절'
                  : (STOCK_PILL[issue.reason] ?? '주문 불가')}
              </span>
            </div>
          ))}
        </div>
        {canContinue ? (
          <button type="button" className="co-pay" onClick={onContinue}>
            품절 상품 빼고 결제하기
          </button>
        ) : null}
        <button type="button" className="co-pay co-pay--ghost" onClick={onBack}>
          장바구니로 돌아가기
        </button>
      </div>
    </div>
  );
}
