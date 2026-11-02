import { useState } from 'react';
import { claimGradeCouponPack, getMyGrade } from './account.api.js';
import { formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import { GRADE_COLORS } from './gradeColors.js';
import './orders.css';
import './mytab.css';

function CouponPack({ pack, items, onClaimed }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await claimGradeCouponPack();
      setMessage(
        result.issuedCount
          ? `쿠폰 ${result.issuedCount}장을 받았어요. 쿠폰함에서 확인하세요.`
          : '이번 달 쿠폰팩을 이미 받았어요.'
      );
      onClaimed();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gr-pack">
      <div className="gr-pack__head">
        <strong>{pack.month} 쿠폰팩</strong>
        <span>{formatFullDate(pack.validUntil)}까지 사용</span>
      </div>
      <ul>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.label}
            {item.minOrder ? <small>{formatWon(item.minOrder)} 이상 주문 시</small> : null}
          </li>
        ))}
      </ul>
      <button type="button" className="ord-btn ord-btn--primary ord-btn--block" disabled={busy || pack.claimed} onClick={claim}>
        {pack.claimed ? '이번 달 쿠폰팩 받음' : `쿠폰 ${items.length}장 받기`}
      </button>
      {message ? <p className="gr-pack__done">{message}</p> : null}
      {error ? <p className="mt-error">{error}</p> : null}
    </section>
  );
}

export default function GradePage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const grade = useRequest(signedIn, 'my-grade', getMyGrade);
  const data = grade.data;

  let body;
  if (grade.error) body = <ErrorNotice error={grade.error} onRetry={grade.reload} />;
  else if (!data) body = <Loading />;
  else {
    const current = data.grade;
    const next = data.nextGrade;
    const progress = next
      ? Math.min(100, Math.round(((data.amount - current.minAmount) / (next.minAmount - current.minAmount)) * 100))
      : 100;
    body = (
      <>
        <section className="mt-hero gr-hero">
          <p className="mt-hero__label">내 회원 등급</p>
          <p className="mt-hero__value" style={{ color: GRADE_COLORS[current.code] }}>{current.name}</p>
          <p className="mt-hero__sub">
            최근 {data.periodMonths}개월 구매 확정 금액 <b>{formatWon(data.amount)}</b>
          </p>
          <div className="gr-progress" aria-hidden="true">
            <i style={{ width: `${progress}%`, background: GRADE_COLORS[current.code] }} />
          </div>
          <p className="mt-hero__sub">
            {next
              ? `${formatWon(data.remainingToNext)} 더 구매하면 ${next.name} 등급이 돼요`
              : '가장 높은 등급이에요'}
          </p>
        </section>

        <div className="gr-perks">
          <div><span>상품 할인</span><strong>{current.discountRate}%</strong></div>
          <div><span>구매 적립</span><strong>{current.earnRate}%</strong></div>
          <div><span>월 쿠폰</span><strong>{current.couponPack.length}장</strong></div>
        </div>

        <CouponPack pack={data.couponPack} items={current.couponPack} onClaimed={grade.reload} />

        <h2 className="mt-h">등급별 혜택</h2>
        <div className="gr-table">
          <div className="gr-table__row gr-table__row--head">
            <span>등급</span><span>기준 금액</span><span>할인</span><span>적립</span><span>쿠폰</span>
          </div>
          {data.grades.map((item) => (
            <div key={item.code} className={`gr-table__row${item.code === current.code ? ' is-mine' : ''}`}>
              <span><b className="gr-badge" style={{ background: GRADE_COLORS[item.code] }}>{item.name}</b></span>
              <span>{item.minAmount ? `${(item.minAmount / 10000).toLocaleString()}만원~` : '가입 시'}</span>
              <span>{item.discountRate}%</span>
              <span>{item.earnRate}%</span>
              <span>{item.couponPack.length}장</span>
            </div>
          ))}
        </div>

        <ul className="mt-guide">
          <li>등급은 최근 {data.periodMonths}개월 동안 구매 확정된 주문의 결제 금액(적립금 사용분 포함)으로 정해져요.</li>
          <li>주문을 취소하거나 반품하면 그 금액은 빠져요.</li>
          <li>등급 할인은 상품 금액에 적용되고, 쿠폰과 함께 쓸 수 있어요.</li>
          <li>구매 적립은 결제 금액에 등급 적립율을 곱해 구매 확정 후 적립돼요.</li>
          <li>쿠폰팩은 매달 한 번 받을 수 있고, 받은 달 말일까지 쓸 수 있어요.</li>
        </ul>
      </>
    );
  }

  return (
    <main className="ord-page">
      <PageHeader title="회원 등급" />
      {body}
    </main>
  );
}
