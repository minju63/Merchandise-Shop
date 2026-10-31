import BottomNavigation from '../../components/BottomNavigation.jsx';
import { useNavigate } from 'react-router-dom';
import {
  BagIcon,
  BellIcon,
  BankIcon,
  BoxIcon,
  CardIcon,
  CartIcon,
  ChevronIcon,
  ClockIcon,
  DocIcon,
  GiftIcon,
  HeadsetIcon,
  HeartIcon,
  HelpIcon,
  LockIcon,
  MegaphoneIcon,
  PinIcon,
  StoreIcon,
  TicketIcon,
  TruckIcon,
  UserIcon,
  WalletIcon,
} from './icons.jsx';
import {
  formatBadgeCount,
  formatPickupDeadline,
  membershipShortName,
  providerLabel,
} from './format.js';
import { getMyPoints } from './account.api.js';
import { useMySummary, useRequest, useSession } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './my.css';
import './mytab.css';

const ORDER_STEPS = [
  ['PAID', '주문 완료'],
  ['PREPARING', '준비 중'],
  ['READY_FOR_PICKUP', '픽업 대기'],
  ['SHIPPING', '배달 중'],
  ['COMPLETED', '수령 완료'],
];

const ClockRowIcon = (props) => <ClockIcon width={22} height={22} {...props} />;

function Badge({ count }) {
  const text = formatBadgeCount(count);
  return text ? <span className="my-badge">{text}</span> : null;
}

function Row({ icon: Icon, label, value, accent, locked, onClick }) {
  return (
    <button type="button" className="my-row" onClick={onClick}>
      <span className="my-row__label">
        {Icon ? <Icon className="my-row__icon" /> : null}
        {label}
      </span>
      <span className="my-row__side">
        {value ? (
          <span className={accent ? 'my-row__value is-accent' : 'my-row__value'}>{value}</span>
        ) : null}
        {locked ? <LockIcon className="my-row__lock" /> : null}
        <ChevronIcon />
      </span>
    </button>
  );
}

function Section({ title, children }) {
  return (
    <section className="my-section">
      <h2 className="my-section__title">{title}</h2>
      <div className="my-section__list">{children}</div>
    </section>
  );
}

function HeaderButton({ label, to, onNavigate, children }) {
  return (
    <button type="button" className="my-icon-btn" aria-label={label} onClick={() => onNavigate(to)}>
      {children}
    </button>
  );
}

function Header({ header, guest, onNavigate }) {
  return (
    <header className="my-header">
      <h1 className="my-header__title">마이</h1>
      <div className="my-header__actions">
        {guest ? null : (
          <HeaderButton label="알림" to={MY_ROUTES.notifications} onNavigate={onNavigate}>
            <BellIcon />
            <Badge count={header?.unreadNotifications} />
          </HeaderButton>
        )}
        <HeaderButton label="장바구니" to={MY_ROUTES.cart} onNavigate={onNavigate}>
          <CartIcon />
          <Badge count={header?.cartItems} />
        </HeaderButton>
      </div>
    </header>
  );
}

function MemberView({ data, provider, onNavigate }) {
  const { profile, orderSummary, activity, membership, readyPickup } = data;
  const plan = membership?.membership_plans?.name;
  const planShort = plan ? membershipShortName(plan) : null;
  const counts = orderSummary?.counts ?? {};
  const points = useRequest(true, 'my-points-card', getMyPoints);

  return (
    <>
      <button type="button" className="my-profile" onClick={() => onNavigate(MY_ROUTES.profile)}>
        <span className="my-avatar">
          {profile.profile_image_url ? (
            <img src={profile.profile_image_url} alt="" />
          ) : (
            <UserIcon />
          )}
        </span>
        <span className="my-profile__body">
          <span className="my-profile__name">
            {profile.nickname}
            {planShort ? <span className="my-pill">{planShort} 멤버십</span> : null}
          </span>
          <span className="my-profile__sub">
            {providerLabel(provider)} 로그인 · {profile.email}
          </span>
        </span>
        <ChevronIcon />
      </button>

      {readyPickup ? (
        <div className="my-pickup">
          <span className="my-pickup__icon">
            <BoxIcon width={20} height={20} />
          </span>
          <div className="my-pickup__body">
            <p className="my-pickup__title">픽업 준비가 완료됐어요</p>
            <p className="my-pickup__sub">
              {readyPickup.stores?.name} · {formatPickupDeadline(readyPickup.pickup_deadline)}
            </p>
          </div>
          <button
            type="button"
            className="my-pickup__btn"
            onClick={() => onNavigate(MY_ROUTES.pickupQr(readyPickup.id))}
          >
            QR 보기
          </button>
        </div>
      ) : null}

      <section className="my-card">
        <button
          type="button"
          className="mt-points-card"
          onClick={() => onNavigate(MY_ROUTES.points)}
        >
          <WalletIcon width={22} height={22} />
          <span className="mt-points-card__text">
            <strong>적립금 {points.data ? formatWon(points.data.balance) : '-'}</strong>
            <span>
              {points.data?.pendingAmount
                ? `적립 예정 ${formatWon(points.data.pendingAmount)} · 결제 금액의 1% 적립`
                : '결제 금액의 1%가 구매 확정 후 적립돼요'}
            </span>
          </span>
          <ChevronIcon />
        </button>
      </section>

      <section className="my-card">
        <div className="my-card__head">
          <h2 className="my-card__title">
            주문 현황 <span className="my-card__hint">최근 3개월</span>
          </h2>
          <button type="button" className="my-link" onClick={() => onNavigate(MY_ROUTES.orders)}>
            전체보기 <ChevronIcon width={14} height={14} />
          </button>
        </div>
        <div className="my-steps">
          {ORDER_STEPS.map(([status, label]) => {
            const count = counts[status] ?? 0;
            const highlight = status === 'READY_FOR_PICKUP' && count > 0;
            return (
              <button
                key={status}
                type="button"
                className="my-step"
                onClick={() => onNavigate(MY_ROUTES.orderStatus(status))}
              >
                <span className={highlight ? 'my-step__count is-accent' : 'my-step__count'}>
                  {count}
                </span>
                <span className="my-step__label">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="my-card my-activity">
        <button type="button" className="my-activity__item" onClick={() => onNavigate('/wishlist')}>
          <HeartIcon className="my-activity__icon" />
          <span className="my-activity__label">찜한 상품</span>
          <span className="my-activity__num">{activity?.wishlistProducts ?? 0}</span>
        </button>
        <button
          type="button"
          className="my-activity__item"
          onClick={() => onNavigate('/wishlist?tab=shops')}
        >
          <StoreIcon className="my-activity__icon" />
          <span className="my-activity__label">찜한 굿즈샵</span>
          <span className="my-activity__num">{activity?.wishlistShops ?? 0}</span>
        </button>
        <button
          type="button"
          className="my-activity__item"
          onClick={() => onNavigate(MY_ROUTES.coupons)}
        >
          <TicketIcon className="my-activity__icon" />
          <span className="my-activity__label">쿠폰</span>
          <span className="my-activity__num">{activity?.availableCoupons ?? 0}</span>
        </button>
      </section>

      <Section title="쇼핑">
        <Row icon={BagIcon} label="전체 주문 내역" onClick={() => onNavigate(MY_ROUTES.orders)} />
        <Row
          icon={StoreIcon}
          label="픽업 주문"
          onClick={() => onNavigate(MY_ROUTES.pickupOrders)}
        />
        <Row
          icon={TruckIcon}
          label="배달 주문"
          onClick={() => onNavigate(MY_ROUTES.deliveryOrders)}
        />
        <Row
          icon={BoxIcon}
          label="취소·반품·교환 내역"
          onClick={() => onNavigate(MY_ROUTES.claims)}
        />
        <Row
          icon={ClockRowIcon}
          label="최근 본 상품"
          onClick={() => onNavigate(MY_ROUTES.recentProducts)}
        />
        <Row
          icon={BellIcon}
          label="사전예약·재입고·알림 신청"
          onClick={() => onNavigate(MY_ROUTES.alerts)}
        />
      </Section>

      <Section title="혜택">
        <Row
          icon={GiftIcon}
          label="멤버십"
          value={plan ? `${planShort} 이용 중` : ''}
          onClick={() => onNavigate(MY_ROUTES.membership)}
        />
        <Row
          icon={TicketIcon}
          label="쿠폰"
          value={activity?.availableCoupons ? `${activity.availableCoupons}장` : ''}
          accent
          onClick={() => onNavigate(MY_ROUTES.coupons)}
        />
        {/* 당첨된 응원 전광판 꾸미기는 응원 결과 화면에서 시작한다 */}
        <Row icon={GiftIcon} label="응원 결과 · 전광판 꾸미기" onClick={() => onNavigate(MY_ROUTES.fanResult)} />
        <Row icon={TicketIcon} label="응원권 구매" onClick={() => onNavigate(MY_ROUTES.fanTickets)} />
      </Section>

      <Section title="이벤트">
        <Row
          icon={MegaphoneIcon}
          label="이번 주 메인은 내 최애"
          onClick={() => onNavigate(MY_ROUTES.weeklyPickEvent)}
        />
      </Section>

      <Section title="정보">
        <Row icon={PinIcon} label="배송지 관리" onClick={() => onNavigate(MY_ROUTES.addresses)} />
        <Row
          icon={CardIcon}
          label="결제수단 관리"
          onClick={() => onNavigate(MY_ROUTES.paymentMethods)}
        />
        <Row
          icon={BankIcon}
          label="환불계좌 관리"
          onClick={() => onNavigate(MY_ROUTES.refundAccounts)}
        />
      </Section>

      <Section title="설정">
        <Row
          icon={BellIcon}
          label="알림 설정"
          onClick={() => onNavigate(MY_ROUTES.notificationSettings)}
        />
        <Row icon={UserIcon} label="개인정보 관리" onClick={() => onNavigate(MY_ROUTES.profile)} />
      </Section>

      <Section title="지원">
        <Row icon={HeadsetIcon} label="고객센터" onClick={() => onNavigate(MY_ROUTES.support)} />
      </Section>

      {profile.role === 'CONSUMER' ? (
        <button
          type="button"
          className="my-seller"
          onClick={() => onNavigate(MY_ROUTES.sellerApply)}
        >
          <StoreIcon />
          <span className="my-seller__text">
            <strong>내 굿즈샵 입점하기</strong>
            <span>매장 재고를 온라인으로 판매해 보세요</span>
          </span>
          <span className="my-seller__cta">신청하기</span>
        </button>
      ) : null}
    </>
  );
}

function GuestView({ onNavigate }) {
  return (
    <>
      <section className="my-card my-guest my-guest--hero">
        <span className="my-avatar my-avatar--light">
          <UserIcon />
        </span>
        <p className="my-guest__text">로그인하고 주문 내역을 확인하세요</p>
        <p className="my-guest__sub">픽업·배달 주문과 쿠폰을 한곳에서 볼 수 있어요</p>
        <button
          type="button"
          className="my-primary-btn"
          onClick={() => onNavigate(MY_ROUTES.login)}
        >
          로그인 / 회원가입
        </button>
      </section>
      <Section title="쇼핑">
        <Row
          icon={BagIcon}
          label="전체 주문 내역"
          locked
          onClick={() => onNavigate(MY_ROUTES.login)}
        />
        <Row icon={TicketIcon} label="쿠폰" locked onClick={() => onNavigate(MY_ROUTES.login)} />
        <Row
          icon={PinIcon}
          label="배송지 관리"
          locked
          onClick={() => onNavigate(MY_ROUTES.login)}
        />
      </Section>
      <Section title="지원">
        <Row icon={MegaphoneIcon} label="공지사항" onClick={() => onNavigate(MY_ROUTES.notices)} />
        <Row icon={HelpIcon} label="자주 묻는 질문" onClick={() => onNavigate(MY_ROUTES.faq)} />
        <Row icon={DocIcon} label="약관 및 정책" onClick={() => onNavigate(MY_ROUTES.terms)} />
      </Section>
    </>
  );
}

function Notice({ message, actionLabel, onAction }) {
  return (
    <section className="my-card my-guest">
      <p className="my-guest__text">{message}</p>
      <button type="button" className="my-primary-btn" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  );
}

export default function MyPage() {
  const navigate = useNavigate();
  const { status, session } = useSession();
  const summary = useMySummary(session?.user?.id);
  const provider = session?.user?.app_metadata?.provider;

  let body;
  if (status === 'loading' || (status === 'in' && summary.loading)) {
    body = <div className="my-loading" role="status" aria-label="불러오는 중" />;
  } else if (status === 'out') {
    body = <GuestView onNavigate={navigate} />;
  } else if (summary.error?.code === 'PROFILE_NOT_FOUND') {
    body = (
      <Notice
        message="아직 가입이 완료되지 않았어요"
        actionLabel="회원가입 계속하기"
        onAction={() => navigate(MY_ROUTES.signup)}
      />
    );
  } else if (summary.error) {
    body = (
      <Notice
        message={summary.error.message || '정보를 불러오지 못했어요'}
        actionLabel="다시 시도"
        onAction={summary.retry}
      />
    );
  } else {
    body = <MemberView data={summary.data} provider={provider} onNavigate={navigate} />;
  }

  return (
    <main className="my-page">
      <Header header={summary.data?.header} guest={status === 'out'} onNavigate={navigate} />
      {body}
      <p className="my-version">앱 버전 1.0.0</p>
      <BottomNavigation />
    </main>
  );
}
