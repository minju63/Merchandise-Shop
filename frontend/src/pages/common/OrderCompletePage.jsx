import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronIcon, CheckIcon } from '../my/icons.jsx';
import { ErrorNotice, Loading } from '../my/common.jsx';
import { useRequest, useRequireLogin } from '../my/hooks.js';
import { formatClock, formatDateTime, formatMonthDay, formatWon } from '../my/orderFormat.js';
import { MY_ROUTES } from '../my/routes.js';
import { getCheckoutResult } from './checkout.api.js';
import { AUTH_ROUTES } from './authRoutes.js';
import '../my/orders.css';
import './checkout.css';

// C-05 결제 완료. 결제 직후에는 state로 결과를 받고, 새로고침하면 서버에서 다시 읽는다.
export default function OrderCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { groupId } = useParams();
  const signedIn = useRequireLogin(AUTH_ROUTES.login);
  const fromState = location.state?.result ?? null;
  const fetched = useRequest(signedIn && !fromState, `checkout-result-${groupId}`, () =>
    getCheckoutResult(groupId),
  );
  const result = fromState ?? fetched.data;
  const names = location.state?.storeNames ?? {};

  if (!result)
    return (
      <main className="co-page">
        {fetched.error ? (
          <ErrorNotice error={fetched.error} onRetry={fetched.reload} />
        ) : (
          <Loading />
        )}
      </main>
    );

  const first = result.orders[0];
  const payment = first?.payments?.[0];

  return (
    <main className="co-page co-complete">
      <section className="co-complete__top">
        <span className="co-complete__check">
          <CheckIcon width={40} height={40} strokeWidth={2.4} />
        </span>
        <h1>주문이 완료됐어요</h1>
        <p>매장에서 주문을 확인하면 알림으로 알려드릴게요</p>
      </section>

      <div className="co-complete__list">
        {result.orders.map((order, index) => {
          const pickup = order.fulfillment_type === 'PICKUP';
          return (
            <button
              key={order.id}
              type="button"
              className="co-done-card"
              onClick={() => navigate(MY_ROUTES.orderDetail(order.id))}
            >
              <span className="co-done-card__head">
                <span className="co-tag">주문 {index + 1}</span>
                <span className="co-tag co-tag--line">{pickup ? '픽업' : '배달'}</span>
                <span className="co-done-card__more">
                  상세 <ChevronIcon width={12} height={12} />
                </span>
              </span>
              <strong>{order.storeName ?? names[order.store_id] ?? '매장'}</strong>
              <span className="co-done-card__sub">
                {pickup && order.pickup_deadline
                  ? `${formatMonthDay(order.pickup_deadline)} ${formatClock(order.pickup_deadline)}까지 픽업`
                  : '배달 준비 중'}{' '}
                · {formatWon(order.total_amount)}
              </span>
            </button>
          );
        })}
      </div>

      <section className="co-done-total">
        <div className="co-done-total__main">
          <strong>결제 금액</strong>
          <strong>{formatWon(result.totalAmount)}</strong>
        </div>
        {payment ? (
          <>
            <div>
              <span>결제수단</span>
              <span>{payment.method_label}</span>
            </div>
            <div>
              <span>결제 일시</span>
              <span>
                {formatDateTime(payment.paid_at ?? payment.created_at ?? first.created_at)}
              </span>
            </div>
          </>
        ) : null}
      </section>

      <div className="co-footer co-footer--two">
        <button
          type="button"
          className="co-pay co-pay--ghost"
          onClick={() => navigate(AUTH_ROUTES.home)}
        >
          쇼핑 계속하기
        </button>
        <button type="button" className="co-pay" onClick={() => navigate(MY_ROUTES.orders)}>
          주문 내역 보기
        </button>
      </div>
    </main>
  );
}
