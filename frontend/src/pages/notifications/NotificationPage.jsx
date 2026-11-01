import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import './NotificationPage.css';

const MOCK_NOTIFICATIONS = [
  {
    id: 'restock-wishlist',
    category: '재입고 소식',
    categoryIcon: '💜',
    time: '방금 전',
    title: '찜한 상품이 재입고됐어요',
    message: '블랙핑크 콘서트 공식 응원봉을 지금 구매할 수 있어요. 다시 품절되기 전에 확인해 보세요.',
    accent: 'restock',
  },
  {
    id: 'pickup-ready',
    category: '픽업 준비 완료',
    categoryIcon: '🛍️',
    time: '10분 전',
    title: '주문하신 상품의 픽업 준비가 끝났어요',
    message: '준비 완료일로부터 7일 이내에 매장을 방문해 수령해 주세요.',
    accent: 'pickup',
  },
];

export default function NotificationPage() {
  const navigate = useNavigate();
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
            <Icon name="cart" size={26} />
          </Link>
        </div>
      </header>

      <main className="notification-feed" aria-label="알림 목록">
        {MOCK_NOTIFICATIONS.map((notification) => (
          <article className={`notification-feed__item is-${notification.accent}`} key={notification.id}>
            <div className="notification-feed__meta">
              <span className="notification-feed__category-icon" aria-hidden="true">{notification.categoryIcon}</span>
              <strong>{notification.category}</strong>
              <time>{notification.time}</time>
              <span className="notification-feed__unread" aria-label="읽지 않은 알림" />
            </div>
            <div className="notification-feed__content">
              <h2>{notification.title}</h2>
              <p>{notification.message}</p>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
