// 담당: 연수
import { useNavigate, useParams } from 'react-router-dom';
import { getCoupon } from './account.api.js';
import { couponConditions, couponHeadline, daysLeft, formatFullDate } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './help.css';

const STATE_LABEL = { AVAILABLE: '사용 가능', USED: '사용 완료', EXPIRED: '기간 만료' };

export default function CouponDetailPage() {
  const navigate = useNavigate();
  const { couponId } = useParams();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const coupon = useRequest(signedIn, `coupon-${couponId}`, () => getCoupon(couponId));
  const item = coupon.data;

  let body;
  if (coupon.error) body = <ErrorNotice error={coupon.error} onRetry={coupon.reload} />;
  else if (!item) body = <Loading />;
  else {
    const usable = item.effectiveStatus === 'AVAILABLE';
    const left = daysLeft(item.effectiveExpiresAt);
    const storeId = item.coupon.store?.id ?? item.coupon.store_id;
    body = (
      <>
        <div className="cpd-hero">
          <strong>{couponHeadline(item)}</strong>
          <p>{item.coupon.name}</p>
        </div>
        <dl className="cpd-list">
          <div>
            <dt>상태</dt>
            <dd>
              {STATE_LABEL[item.effectiveStatus]}
              {usable ? ` · ${left <= 0 ? 'D-Day' : `D-${left}`}` : ''}
            </dd>
          </div>
          <div>
            <dt>사용 조건</dt>
            <dd>{couponConditions(item)}</dd>
          </div>
          <div>
            <dt>유효기간</dt>
            <dd>{formatFullDate(item.effectiveExpiresAt)}까지</dd>
          </div>
        </dl>
        {usable ? (
          <footer className="ord-footer">
            <button
              type="button"
              className="ord-btn ord-btn--primary ord-btn--block"
              onClick={() => navigate(storeId ? MY_ROUTES.store(storeId) : MY_ROUTES.shop)}
            >
              {storeId ? '이 굿즈샵에서 사용하기' : '쿠폰 사용하러 가기'}
            </button>
          </footer>
        ) : null}
      </>
    );
  }

  return (
    <main className="ord-page">
      <PageHeader title="쿠폰 상세" />
      {body}
    </main>
  );
}
