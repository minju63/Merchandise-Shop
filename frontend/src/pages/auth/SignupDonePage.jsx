// 담당: 연수
import { useLocation, useNavigate } from 'react-router-dom';
import { listCoupons } from '../my/account.api.js';
import { couponHeadline, formatMonthDot } from '../my/accountFormat.js';
import { formatWon } from '../my/orderFormat.js';
import { useRequest } from '../my/hooks.js';
import { CheckIcon, TicketIcon } from '../my/icons.jsx';
import { MY_ROUTES } from '../my/routes.js';
import { AUTH_ROUTES } from './authRoutes.js';
import './auth.css';

export default function SignupDonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const nickname = location.state?.signup?.user?.nickname ?? '회원';
  const coupons = useRequest(true, 'signup-coupons', listCoupons);
  const welcome = (coupons.data?.items ?? []).find((item) => item.effectiveStatus === 'AVAILABLE');

  return (
    <main className="lg-page">
      <section className="lg-done">
        <span className="lg-done__check">
          <CheckIcon width={40} height={40} strokeWidth={2.4} />
        </span>
        <h1>가입을 환영해요!</h1>
        <p className="lg-done__desc">
          {nickname}님, 이제 굿즈팡에서
          <br />
          동네 굿즈샵 재고를 확인하고 바로 주문할 수 있어요
        </p>

        {welcome ? (
          <>
            <div className="lg-benefit">
              <span className="lg-benefit__icon">
                <TicketIcon />
              </span>
              <div className="lg-benefit__text">
                <strong>
                  {welcome.coupon.name} {couponHeadline(welcome)}
                </strong>
                <span>
                  {welcome.coupon.min_order_amount > 0
                    ? `${formatWon(welcome.coupon.min_order_amount)} 이상 · `
                    : ''}
                  {formatMonthDot(welcome.effectiveExpiresAt)}까지
                </span>
              </div>
              <span className="lg-benefit__pill">지급 완료</span>
            </div>
            <button
              type="button"
              className="lg-done__link"
              onClick={() => navigate(MY_ROUTES.coupons)}
            >
              쿠폰함 보기
            </button>
          </>
        ) : null}
      </section>

      <div className="lg-footer">
        <button
          type="button"
          className="lg-main-btn"
          onClick={() => navigate(AUTH_ROUTES.home, { replace: true })}
        >
          굿즈팡 시작하기
        </button>
      </div>
    </main>
  );
}
