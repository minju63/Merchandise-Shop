// 상품 / 굿즈샵 상단 탭 + 개수
// 담당: 동균
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { isAuthError, wishlistApi } from '../../../api/wishlist.api.js';

export default function WishTabBar() {
  const { data } = useQuery({
    queryKey: ['wishlist', 'counts'],
    queryFn: wishlistApi.counts,
    retry: (count, error) => !isAuthError(error) && count < 1,
  });
  const counts = data?.data;
  const tabs = [
    { to: '/wish', label: '상품', count: counts?.products },
    { to: '/wish/shops', label: '굿즈샵', count: counts?.shops },
  ];
  return (
    <header className="wish-header">
      <h1>찜</h1>
      <nav className="wish-tabs" aria-label="찜 목록 종류">
        {tabs.map(({ to, label, count }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) => `wish-tab${isActive ? ' is-active' : ''}`}
          >
            {label}
            {count !== undefined && <span className="wish-tab-count">{count}</span>}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
