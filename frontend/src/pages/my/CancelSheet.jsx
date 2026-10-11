import { useState } from 'react';
import { cancelOrder } from './my.api.js';
import { formatWon } from './orderFormat.js';

const REASONS = [
  ['CHANGE_OF_MIND', '단순 변심'],
  ['CHANGE_FULFILLMENT', '수령 방식 변경'],
  ['BUY_ELSEWHERE', '다른 매장에서 구매'],
  ['ORDER_MISTAKE', '주문 실수'],
  ['ETC', '기타 (직접 입력)'],
];

// M-05 주문 취소 바텀시트
export default function CancelSheet({ order, onClose, onDone }) {
  const [reason, setReason] = useState('CHANGE_OF_MIND');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const needsDetail = reason === 'ETC';
  const canSubmit = !submitting && (!needsDetail || detail.trim().length > 0);

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await cancelOrder(order.id, needsDetail ? { reason, detail: detail.trim() } : { reason });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="ord-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ord-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="주문 취소"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="ord-sheet__grip" />
        <h2 className="ord-sheet__title">주문을 취소할까요?</h2>
        <p className="ord-sheet__sub">
          {order.store?.name} · {order.order_no}
        </p>

        <fieldset className="ord-reasons">
          <legend>
            취소 사유 <span className="ord-required">*</span>
          </legend>
          {REASONS.map(([value, label]) => (
            <label key={value} className="ord-reason">
              <input
                type="radio"
                name="cancel-reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              <span className="ord-reason__dot" />
              {label}
            </label>
          ))}
        </fieldset>

        {needsDetail ? (
          <textarea
            className="ord-textarea"
            maxLength={500}
            rows={3}
            placeholder="취소 사유를 입력해 주세요"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
        ) : null}

        <div className="ord-refund">
          <div className="ord-refund__row ord-refund__row--main">
            <span>환불 예정 금액</span>
            <strong>{formatWon(order.total_amount)}</strong>
          </div>
          {order.used_coupon_id && order.discount_amount > 0 ? (
            <>
              <div className="ord-refund__row">
                <span>복원 쿠폰</span>
                <span>{formatWon(order.discount_amount)} 할인</span>
              </div>
              <p className="ord-refund__note">유효기간이 남은 쿠폰만 돌려드려요</p>
            </>
          ) : null}
        </div>

        {error ? <p className="ord-sheet__error">{error}</p> : null}

        <div className="ord-sheet__actions">
          <button type="button" className="ord-btn" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="ord-btn ord-btn--primary"
            disabled={!canSubmit}
            onClick={submit}
          >
            주문 취소하기
          </button>
        </div>
      </div>
    </div>
  );
}
