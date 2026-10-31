import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCoupons, registerCoupon } from './account.api.js';
import { couponConditions, couponHeadline, daysLeft, formatMonthDot } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { ChevronIcon } from './icons.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';

function CouponCard({ item, usable, onUse, onOpen }) {
  const left = daysLeft(item.effectiveExpiresAt);
  const dday = left <= 0 ? 'D-Day' : `D-${left}`;
  const stateLabel = item.effectiveStatus === 'USED' ? '사용 완료' : '기간 만료';
  return (
    <article className={usable ? 'cpn-card' : 'cpn-card is-off'}>
      <div
        className="cpn-card__main"
        role="link"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => event.key === 'Enter' && onOpen()}
      >
        <strong className="cpn-card__amount">{couponHeadline(item)}</strong>
        <p className="cpn-card__name">{item.coupon.name}</p>
        <p className="cpn-card__cond">{couponConditions(item)}</p>
        <p className="cpn-card__date">
          {formatMonthDot(item.effectiveExpiresAt)}까지
          {usable ? (
            <span className="cpn-dday">{dday}</span>
          ) : (
            <span className="cpn-dday">{stateLabel}</span>
          )}
        </p>
      </div>
      {usable ? (
        <button type="button" className="cpn-card__use" onClick={onUse}>
          <ChevronIcon />
          <span>
            사용하러
            <br />
            가기
          </span>
        </button>
      ) : null}
    </article>
  );
}

export default function CouponsPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const coupons = useRequest(signedIn, 'coupons', listCoupons);
  const [tab, setTab] = useState('AVAILABLE');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const register = async () => {
    const value = code.trim().toUpperCase();
    if (!value) return;
    setBusy(true);
    setMessage(null);
    try {
      await registerCoupon(value);
      setCode('');
      setMessage({ ok: true, text: '쿠폰을 등록했어요' });
      coupons.reload();
    } catch (error) {
      setMessage({ ok: false, text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const items = coupons.data?.items ?? [];
  const available = items.filter((item) => item.effectiveStatus === 'AVAILABLE');
  const inactive = items.filter((item) => item.effectiveStatus !== 'AVAILABLE');
  const shown = tab === 'AVAILABLE' ? available : inactive;

  let body;
  if (coupons.error) body = <ErrorNotice error={coupons.error} onRetry={coupons.reload} />;
  else if (!coupons.data) body = <Loading />;
  else if (shown.length === 0)
    body = (
      <p className="ord-empty">
        {tab === 'AVAILABLE' ? '사용 가능한 쿠폰이 없어요' : '사용 완료·만료된 쿠폰이 없어요'}
      </p>
    );
  else
    body = shown.map((item) => (
      <CouponCard
        key={item.id}
        item={item}
        usable={tab === 'AVAILABLE'}
        onUse={() =>
          navigate(item.coupon.store?.id ? MY_ROUTES.store(item.coupon.store.id) : MY_ROUTES.shop)
        }
        onOpen={() => navigate(MY_ROUTES.couponDetail(item.id))}
      />
    ));

  return (
    <main className="ord-page">
      <PageHeader title="쿠폰" />
      <div className="cpn-register">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && register()}
          placeholder="쿠폰 코드를 입력하세요"
          aria-label="쿠폰 코드"
        />
        <button type="button" disabled={busy || !code.trim()} onClick={register}>
          등록
        </button>
      </div>
      {message ? <p className={message.ok ? 'cpn-msg is-ok' : 'cpn-msg'}>{message.text}</p> : null}
      <div className="ord-tabs ord-tabs--two" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'AVAILABLE'}
          className={tab === 'AVAILABLE' ? 'ord-tab is-active' : 'ord-tab'}
          onClick={() => setTab('AVAILABLE')}
        >
          사용 가능 {coupons.data ? available.length : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'DONE'}
          className={tab === 'DONE' ? 'ord-tab is-active' : 'ord-tab'}
          onClick={() => setTab('DONE')}
        >
          사용 완료 · 만료
        </button>
      </div>
      <div className="ord-list cpn-list">{body}</div>
    </main>
  );
}
