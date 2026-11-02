import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cancelMembership,
  claimMembershipCouponPack,
  getMembershipCouponPack,
  getMyMembership,
  listPaymentMethods,
  listPlans,
  subscribeMembership,
} from './account.api.js';
import { formatFullDate, planBenefitText } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { CheckIcon } from './icons.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';
import './mytab.css';
import { useDialog } from '../../components/useDialog.jsx';
import { PaymentMethodSheet } from '../fan/PaymentMethodPicker.jsx';
import { selectedPaymentName } from '../fan/paymentMethodPickerFormat.js';
import '../fan/FanCheer.css';

const HERO_POINTS = ['배달비 1,000원 할인', '매달 멤버십 쿠폰팩 (최대 3장)', '재입고 알림 우선 발송'];

// 이번 달 멤버십 쿠폰팩: 베이직 1장, 플러스 3장. 등급 쿠폰팩과는 따로 받는다.
function MembershipCouponPack() {
  const pack = useRequest(true, 'membership-coupon-pack', getMembershipCouponPack);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const data = pack.data;
  if (!data?.available) return null;

  const claim = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await claimMembershipCouponPack();
      setMessage(
        result.issuedCount
          ? `쿠폰 ${result.issuedCount}장을 받았어요. 쿠폰함에서 확인하세요.`
          : '이번 달 멤버십 쿠폰을 이미 받았어요.'
      );
      pack.reload();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gr-pack mbr-coupons">
      <div className="gr-pack__head">
        <strong>{data.plan.name} 멤버십 · {data.month} 쿠폰</strong>
        <span>{formatFullDate(data.validUntil)}까지 사용</span>
      </div>
      <ul>
        {data.items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {item.label}
            {item.minOrder ? <small>{formatWon(item.minOrder)} 이상 주문 시</small> : null}
          </li>
        ))}
      </ul>
      <button type="button" className="ord-btn ord-btn--primary ord-btn--block" disabled={busy || data.claimed} onClick={claim}>
        {data.claimed ? '이번 달 멤버십 쿠폰 받음' : `쿠폰 ${data.items.length}장 받기`}
      </button>
      {message ? <p className="gr-pack__done">{message}</p> : null}
      {error ? <p className="mt-error">{error}</p> : null}
    </section>
  );
}

function ActiveMembership({ membership, onChanged }) {
  const { confirm, dialog } = useDialog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plan = membership.plan;
  const canceled = membership.status === 'CANCELED' || !membership.auto_renew;

  const cancel = async () => {
    if (
      !(await confirm(
        '다음 갱신부터 멤버십을 해지할까요? 이용 기간이 끝날 때까지는 계속 쓸 수 있어요.',
        { confirmLabel: '해지' }
      ))
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
      <MembershipCouponPack />
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
      {dialog}
    </>
  );
}

function Subscribe({ plans, onSubscribed }) {
  const navigate = useNavigate();
  const methods = useRequest(true, 'membership-methods', listPaymentMethods);
  const [choice, setChoice] = useState(null);
  const [step, setStep] = useState('plan');
  const [paymentOption, setPaymentOption] = useState(null);
  const [methodId, setMethodId] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedCode = choice ?? plans[plans.length - 1]?.code;
  const plan = plans.find((item) => item.code === selectedCode);
  // 굿즈픽페이·등록 계좌는 은행 계좌만 고를 수 있다 (응원권 결제와 같은 규칙)
  const bankAccounts = (methods.data?.items ?? []).filter((item) => item.method_type === 'BANK_ACCOUNT');

  const subscribe = async () => {
    setBusy(true);
    setError('');
    try {
      await subscribeMembership({
        planCode: plan.code,
        paymentOption,
        paymentMethodId: methodId,
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
        <h2 className="mbr-section">결제 정보</h2>
        <p className="fan-refund-sheet__to">
          <b>{plan.name}</b> · 월 {formatWon(plan.monthly_price)}
        </p>
        <h2 className="mbr-section">결제수단</h2>
        {methods.error ? <ErrorNotice error={methods.error} onRetry={methods.reload} /> : null}
        <div className={paymentOption ? 'fan-payment-summary is-selected' : 'fan-payment-summary'}>
          <span className="fan-payment-summary__icon" aria-hidden="true">₩</span>
          <div>
            <strong>{selectedPaymentName(paymentOption, methodId, bankAccounts)}</strong>
            <small>{paymentOption ? `월 ${formatWon(plan.monthly_price)} 결제 예정` : '결제 전에 수단을 선택해 주세요'}</small>
          </div>
          <button type="button" onClick={() => setSheetOpen(true)}>
            {paymentOption ? '변경' : '선택'}
          </button>
        </div>
        <label className="fan-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
          />
          선택한 결제수단으로 월 {formatWon(plan.monthly_price)}을 결제하는 데 동의해요
        </label>
        <p className="mbr-note">
          지금은 시연용 모의 결제라 실제 결제는 일어나지 않아요. 매달 자동으로 갱신되고, 멤버십 관리에서 언제든 자동 갱신을 끌 수 있어요.
        </p>
        {error ? <p className="ord-sheet__error">{error}</p> : null}
        <footer className="ord-footer">
          <button type="button" className="ord-btn" onClick={() => setStep('plan')}>
            이전
          </button>
          <button
            type="button"
            className="ord-btn ord-btn--primary ord-btn--grow"
            disabled={!agreed || !paymentOption || busy}
            onClick={subscribe}
          >
            월 {formatWon(plan.monthly_price)} 구독하기
          </button>
        </footer>
        {sheetOpen ? (
          <PaymentMethodSheet
            currentOption={paymentOption}
            currentMethodId={methodId}
            methods={methods.data ? bankAccounts : undefined}
            onAdd={() => navigate(MY_ROUTES.paymentMethods)}
            onClose={() => setSheetOpen(false)}
            onConfirm={(option, id = null) => {
              setPaymentOption(option);
              setMethodId(id);
              setAgreed(false);
            }}
          />
        ) : null}
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
