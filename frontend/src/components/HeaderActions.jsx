// 검색 · 알림 · 장바구니 아이콘 묶음 (찜, 마이 상단에서 사용)
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { notificationApi } from '../api/notification.api.js';
import { useSession } from '../pages/my/hooks.js';
import CartIconBadge from './CartIconBadge.jsx';
import Icon from './Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import './HeaderActions.css';

export default function HeaderActions() {
  const { status, session } = useSession();
  const badges = useQuery({
    queryKey: ['header-badges', session?.user?.id],
    queryFn: notificationApi.badges,
    enabled: status === 'in' && Boolean(session?.user?.id),
    retry: false,
  });
  const notifications = Number(badges.data?.data?.notifications ?? 0);

  return (
    <div className="header-actions-bar">
      <Link to="/search" aria-label="검색">
        <Icon name="search" size={22} />
      </Link>
      <NotificationBell iconSize={22} count={notifications} />
      <Link to="/cart" aria-label="장바구니">
        <CartIconBadge size={22} />
      </Link>
    </div>
  );
}
