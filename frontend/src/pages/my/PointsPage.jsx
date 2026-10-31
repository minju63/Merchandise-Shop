// 담당: 연수
import { getMyPoints } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';

const TYPE_LABEL = {
  EARN: '구매 적립',
  USE: '주문 결제에 사용',
  USE_CANCEL: '주문 취소로 돌려받음',
  REVIEW_REWARD: '리뷰 작성 적립',
};

export default function PointsPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const points = useRequest(signedIn, 'my-points', getMyPoints);
  const data = points.data;

  let body;
  if (points.error) body = <ErrorNotice error={points.error} onRetry={points.reload} />;
  else if (!data) body = <Loading />;
  else
    body = (
      <>
        <section className="mt-hero">
          <p className="mt-hero__label">사용 가능한 적립금</p>
          <p className="mt-hero__value">{formatWon(data.balance)}</p>
          <p className="mt-hero__sub">적립 예정 {formatWon(data.pendingAmount)}</p>
        </section>
        <ul className="mt-guide">
          <li>결제 금액의 {data.policy.earnRatePercent}%가 구매 확정 후 적립돼요.</li>
          <li>
            적립금은 1원 단위로 쓸 수 있고, 보유 적립금이 {data.policy.minUse.toLocaleString()}원
            이상일 때부터 사용할 수 있어요.
          </li>
          <li>
            결제할 때 &lsquo;적립예정금 바로 사용&rsquo;을 고르면 이번 주문의 예정 적립금을 바로
            쓰고, 그 주문은 추가 적립이 없어요.
          </li>
          <li>구매한 상품의 리뷰를 쓰면 적립금 {data.policy.reviewReward.toLocaleString()}원이 바로 적립돼요. (상품당 1회)</li>
          <li>주문을 취소하면 사용한 적립금은 돌려받고, 적립 예정분은 사라져요.</li>
        </ul>
        <h2 className="mt-h">적립금 내역</h2>
        {data.items.length === 0 ? (
          <p className="ord-empty">아직 적립금 내역이 없어요</p>
        ) : (
          data.items.map((item) => (
            <div key={item.id} className="mt-row">
              <div className="mt-row__main">
                <strong>
                  {TYPE_LABEL[item.type] ?? item.memo}
                  {item.status === 'PENDING' ? <span className="mt-tag">적립 예정</span> : null}
                </strong>
                <span>{formatFullDate(item.createdAt)}</span>
              </div>
              <span className={item.amount > 0 ? 'mt-amount is-plus' : 'mt-amount'}>
                {item.amount > 0 ? '+' : '-'}
                {formatWon(Math.abs(item.amount))}
              </span>
            </div>
          ))
        )}
      </>
    );

  return (
    <main className="ord-page">
      <PageHeader title="적립금" />
      {body}
    </main>
  );
}
