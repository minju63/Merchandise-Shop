import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import CartIconBadge from '../../components/CartIconBadge.jsx';
import { notificationApi } from '../../api/notification.api.js';
import { useRequireLogin, useSession } from '../my/hooks.js';
import './NotificationPage.css';

const TYPE_META = {
  RESTOCK: ['재입고 소식', '💜', 'restock'],
  PICKUP_READY: ['픽업 준비 완료', '🛍️', 'pickup'],
  ORDER_STATUS: ['주문 소식', '📦', 'pickup'],
  FAN_BANNER: ['응원 전광판', '🎉', 'restock'],
  COUPON: ['쿠폰 소식', '🎟️', 'restock'],
};

function notificationMeta(type) {
  return TYPE_META[type] ?? ['굿즈픽 소식', '🔔', 'restock'];
}

function timeLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' });
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const loggedIn = useRequireLogin('/login');
  const notifications = useQuery({
    queryKey: ['notifications', session?.user?.id],
    queryFn: async () => {
      await notificationApi.readAll();
      queryClient.setQueriesData({ queryKey: ['header-badges'] }, (current) => (
        current?.data ? { ...current, data: { ...current.data, notifications: 0 } } : current
      ));
      return notificationApi.list();
    },
    enabled: loggedIn && Boolean(session?.user?.id),
    retry: false,
  });
  const items = notifications.data?.data?.items ?? [];
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <div className="notification-page">
      <header className="notification-page__header">
        <button type="button" onClick={goBack} aria-label="뒤로가기">
          <Icon name="back" size={28} />
        </button>
        <h1>알림</h1>
        <div className="notification-page__actions">
          <Link to="/search" aria-label="검색">
            <Icon name="search" size={25} />
          </Link>
          <Link to="/cart" aria-label="장바구니">
            <CartIconBadge size={26} />
          </Link>
        </div>
      </header>

      <main className="notification-feed" aria-label="알림 목록">
        {notifications.isPending ? <p className="notification-feed__state">알림을 불러오는 중...</p> : null}
        {notifications.isError ? <p className="notification-feed__state is-error">{notifications.error.message}</p> : null}
        {!notifications.isPending && !notifications.isError && items.length === 0 ? (
          <p className="notification-feed__state">도착한 알림이 없어요.</p>
        ) : null}
        {items.map((notification) => {
          const [category, categoryIcon, accent] = notificationMeta(notification.type);
          return (
            <article className={`notification-feed__item is-${accent}`} key={notification.id}>
              <div className="notification-feed__meta">
                <span className="notification-feed__category-icon" aria-hidden="true">{categoryIcon}</span>
                <strong>{category}</strong>
                <time dateTime={notification.createdAt}>{timeLabel(notification.createdAt)}</time>
              </div>
              <div className="notification-feed__content">
                <h2>{notification.title}</h2>
                <p>{notification.body}</p>
              </div>
            </article>
          );
        })}
        <p className="notification-feed__retention">알림은 받은 날로부터 30일 후 순차적으로 삭제돼요.</p>
      </main>
    </div>
  );
}
