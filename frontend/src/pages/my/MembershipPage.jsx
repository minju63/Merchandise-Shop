import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cancelMembership,
  getMyMembership,
  listPaymentMethods,
  listPlans,
  subscribeMembership,
} from './account.api.js';
import { formatFullDate, paymentMethodName, planBenefitText } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { CheckIcon } from './icons.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';

const HERO_POINTS = ['배달비 1,000원 할인', '매달 쿠폰 팩 3장', '재입고 알림 우선 발송'];

function ActiveMembership({ membership, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plan = membership.plan;
  const canceled = membership.status === 'CANCELED' || !membership.auto_renew;

  const cancel = async () => {
    if (
      !window.confirm(
        '다음 갱신부터 멤버십을 해지할까요? 이용 기간이 끝날 때까지는 계속 쓸 수 있어요.'
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await cancelMembership();
      onChanged();
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  return (
    <>
      <section className="mbr-hero">
        <p className="mbr-hero__eyebrow">굿즈 멤버십</p>
        <h2 className="mbr-hero__title">{plan.name} 이용 중</h2>
        <ul className="mbr-hero__list">
          <li>
            <CheckIcon /> {planBenefitText(plan) || '멤버십 혜택을 이용할 수 있어요'}
          </li>
          <li>
            <CheckIcon /> {formatFullDate(membership.current_period_end)}까지 이용{' '}
            {canceled ? '(해지 예약됨)' : '후 자동 갱신'}
          </li>
        </ul>
      </section>
      <p className="mbr-note">
        월 {formatWon(plan.monthly_price)} · 시연용 결제라 실제 청구는 없어요.
      </p>
      {error ? <p className="ord-sheet__error">{error}</p> : null}
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--block"
          disabled={busy || canceled}
          onClick={cancel}
        >
          {canceled ? '해지 예약됨' : '멤버십 해지 예약'}
        </button>
      </footer>
    </>
  );
}

function Subscribe({ plans, onSubscribed }) {
  const navigate = useNavigate();
  const methods = useRequest(true, 'membership-methods', listPaymentMethods);
  const [choice, setChoice] = useState(null);
  const [step, setStep] = useState('plan');
  const [methodId, setMethodId] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedCode = choice ?? plans[plans.length - 1]?.code;
  const plan = plans.find((item) => item.code === selectedCode);
  const methodItems = methods.data?.items ?? [];
  const activeMethodId =
    methodId ?? methodItems.find((item) => item.is_default)?.id ?? methodItems[0]?.id ?? null;

  const subscribe = async () => {
    setBusy(true);
    setError('');
    try {
      await subscribeMembership({
        planCode: plan.code,
        paymentMethodId: activeMethodId,
        autoRenew: true,
        paymentAgreed: true,
      });
      onSubscribed();
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  if (step === 'pay') {
    return (
      <>
        <h2 className="mbr-section">결제수단 선택</h2>
        {methods.error ? <ErrorNotice error={methods.error} onRetry={methods.reload} /> : null}
        {methods.loading ? <Loading /> : null}
        {methods.data && methodItems.length === 0 ? (
          <p className="ord-empty">
            등록된 결제수단이 없어요
            <br />
            <button
              type="button"
              className="adr-card__link"
              onClick={() => navigate(MY_ROUTES.paymentMethods)}
            >
              결제수단 추가하러 가기
            </button>
          </p>
        ) : null}
        <div className="ord-list">
          {methodItems.map((method) => (
            <label
              key={method.id}
              className={activeMethodId === method.id ? 'mbr-plan is-on' : 'mbr-plan'}
            >
              <input
                type="radio"
                name="method"
                checked={activeMethodId === method.id}
                onChange={() => setMethodId(method.id)}
              />
              <span className="ord-reason__dot" />
              <span className="mbr-plan__text">
                <strong>{paymentMethodName(method)}</strong>
              </span>
            </label>
          ))}
        </div>
        <label className="frm__check mbr-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          시연용 구독 결제에 동의해요 (실제 결제는 이뤄지지 않아요)
        </label>
        <p className="mbr-note">
          매달 자동으로 갱신돼요. 멤버십 관리에서 언제든 자동 갱신을 끌 수 있어요.
        </p>
        {error ? <p className="ord-sheet__error">{error}</p> : null}
        <footer className="ord-footer">
          <button type="button" className="ord-btn" onClick={() => setStep('plan')}>
            이전
          </button>
          <button
            type="button"
            className="ord-btn ord-btn--primary ord-btn--grow"
            disabled={!agreed || !activeMethodId || busy}
            onClick={subscribe}
          >
            월 {formatWon(plan.monthly_price)} 구독하기
          </button>
        </footer>
      </>
    );
  }

  return (
    <>
      <section className="mbr-hero">
        <p className="mbr-hero__eyebrow">굿즈 멤버십</p>
        <h2 className="mbr-hero__title">
          매달 쿠폰 받고
          <br />
          배달비는 덜 내요
        </h2>
        <ul className="mbr-hero__list">
          {HERO_POINTS.map((point) => (
            <li key={point}>
              <CheckIcon /> {point}
            </li>
          ))}
        </ul>
      </section>
      <h2 className="mbr-section">요금제 선택</h2>
      <div className="ord-list">
        {plans.map((item) => (
          <label
            key={item.code}
            className={selectedCode === item.code ? 'mbr-plan is-on' : 'mbr-plan'}
          >
            <input
              type="radio"
              name="plan"
              checked={selectedCode === item.code}
              onChange={() => setChoice(item.code)}
            />
            <span className="ord-reason__dot" />
            <span className="mbr-plan__text">
              <strong>{item.name}</strong>
              <span>{planBenefitText(item)}</span>
            </span>
            <strong className="mbr-plan__price">월 {formatWon(item.monthly_price)}</strong>
          </label>
        ))}
      </div>
      <p className="mbr-note">
        매달 자동으로 갱신돼요. 멤버십 관리에서 언제든 자동 갱신을 끌 수 있어요.
      </p>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          disabled={!plan}
          onClick={() => setStep('pay')}
        >
          다음
        </button>
      </footer>
    </>
  );
}

export default function MembershipPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const mine = useRequest(signedIn, 'my-membership', getMyMembership);
  const plans = useRequest(signedIn, 'membership-plans', listPlans);

  let body;
  const error = mine.error || plans.error;
  if (error) body = <ErrorNotice error={error} onRetry={() => (mine.reload(), plans.reload())} />;
  else if (!mine.data || !plans.data) body = <Loading />;
  else if (mine.data.membership)
    body = <ActiveMembership membership={mine.data.membership} onChanged={mine.reload} />;
  else if (plans.data.items.length === 0)
    body = <p className="ord-empty">지금 가입할 수 있는 멤버십이 없어요</p>;
  else body = <Subscribe plans={plans.data.items} onSubscribed={mine.reload} />;

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="멤버십" />
      {body}
    </main>
  );
}
