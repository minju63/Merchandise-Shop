// 사전예약 신청 (J-06)
// 담당: 동균
// 사전예약은 재고를 잡지 않는다. 입고 후 순번대로 배분되며, 예약금은 모의 결제다.
import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { preorderApi } from '../../../api/preorder.api.js';

const won = (value) => `${Number(value ?? 0).toLocaleString('ko-KR')}원`;
const dateText = (value) =>
  new Date(value).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

export default function PreorderSheet({ item, onClose, onDone, onFail }) {
  const [quantity, setQuantity] = useState(1);
  // 수량을 바꿀 때마다 서버에서 금액을 다시 계산한다.
  const quoteQuery = useQuery({
    queryKey: ['preorders', 'quote', item.storeProductId, quantity],
    queryFn: () => preorderApi.quote({ storeProductId: item.storeProductId, qty: quantity }),
    placeholderData: keepPreviousData,
  });
  const createMutation = useMutation({
    mutationFn: () => preorderApi.create({ storeProductId: item.storeProductId, quantity }),
    onSuccess: (response) => onDone(response.data),
    onError: onFail,
  });
  const quote = quoteQuery.data?.data;
  const busy = createMutation.isPending || quoteQuery.isFetching;
  const maxQuantity = quote?.maxPerOrder ?? Infinity;

  return (
    <div className="wish-dialog-backdrop wish-sheet-backdrop" onClick={createMutation.isPending ? undefined : onClose}>
      <div
        className="wish-sheet wish-preorder-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wish-preorder-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="wish-preorder-title">사전예약</h2>
        <div className="wish-sheet-product">
          <span className="wish-sheet-thumb">
            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span className="wish-thumb-placeholder" />}
          </span>
          <div>
            <span className="wish-stock-badge is-blue wish-inline-badge">입고 예정</span>
            <p className="wish-sheet-product-name">{item.productName}</p>
            <p className="wish-sheet-store">{item.storeName}</p>
            {quote && <p className="wish-sheet-price">{won(quote.unitPrice)}</p>}
          </div>
        </div>
        <p className="wish-preorder-priority-note">
          굿즈 패스 플러스 회원은 일반 회원보다 먼저 예약돼요. 입고되면 예약 순번대로 배분돼요.
        </p>

        {quoteQuery.isError && !quote ? (
          <p className="wish-dialog-error">견적을 불러오지 못했어요.</p>
        ) : (
          quote && (
            <>
              <dl className="wish-preorder-info">
                {quote.restockExpectedAt && (
                  <div>
                    <dt>입고 예정일</dt>
                    <dd>{dateText(quote.restockExpectedAt)}</dd>
                  </div>
                )}
                <div>
                  <dt>예상 순번</dt>
                  <dd>{quote.expectedPriority}번째</dd>
                </div>
                <div>
                  <dt>수량</dt>
                  <dd>
                    <span className="wish-quantity">
                      <button
                        type="button"
                        disabled={busy || quantity <= 1}
                        onClick={() => setQuantity(quantity - 1)}
                        aria-label="수량 줄이기"
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        disabled={busy || quantity >= maxQuantity}
                        onClick={() => setQuantity(quantity + 1)}
                        aria-label="수량 늘리기"
                      >
                        +
                      </button>
                    </span>
                  </dd>
                </div>
              </dl>
              <dl className="wish-preorder-amounts">
                <div>
                  <dt>상품 금액</dt>
                  <dd>{won(quote.totalAmount)}</dd>
                </div>
                <div>
                  <dt>예약금 (20%)</dt>
                  <dd>{won(quote.depositAmount)}</dd>
                </div>
                <div className="is-strong">
                  <dt>지금 결제할 금액</dt>
                  <dd>{won(quote.depositAmount)}</dd>
                </div>
                <div>
                  <dt>픽업 시 낼 잔액</dt>
                  <dd>{won(quote.balanceAmount)}</dd>
                </div>
              </dl>
            </>
          )
        )}

        <p className="wish-preorder-notice">
          예약금은 픽업 시 결제 금액에서 차감됩니다.
          <br />
          픽업 기한이 지나면 환불되지 않습니다.
        </p>
        <button
          type="button"
          className="wish-sheet-primary"
          disabled={!quote || busy}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? '예약 중…' : `예약금 ${won(quote?.depositAmount)} 결제하고 예약`}
        </button>
        <button type="button" className="wish-sheet-cancel" disabled={createMutation.isPending} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
