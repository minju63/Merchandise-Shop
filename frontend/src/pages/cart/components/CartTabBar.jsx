// 픽업 / 배달 탭
// 담당: 동균
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cartApi } from '../../../api/cart.api.js';
import { isAuthError } from '../../../api/wishlist.api.js';
import Icon from '../../../components/Icon.jsx';

export default function CartTabBar({ type }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['cart', 'counts'],
    queryFn: cartApi.counts,
    retry: (count, error) => !isAuthError(error) && count < 1,
  });
  const counts = data?.data;
  const tabs = [
    { type: 'PICKUP', label: '픽업', count: counts?.pickup },
    { type: 'DELIVERY', label: '배달', count: counts?.delivery },
  ];
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate('/wish', { replace: true });
  };
  return (
    <header className="cart-header">
      <div className="cart-header-row">
        <button type="button" className="cart-back" onClick={goBack} aria-label="뒤로가기">
          <Icon name="back" />
        </button>
        <h1>장바구니</h1>
      </div>
      <nav className="cart-tabs" aria-label="수령 방법">
        {tabs.map((tab) => (
          <Link
            key={tab.type}
            to={`/cart?type=${tab.type}`}
            replace
            className={`cart-tab${tab.type === type ? ' is-active' : ''}`}
            aria-current={tab.type === type ? 'page' : undefined}
          >
            {tab.label}
            {tab.count !== undefined && <span className="cart-tab-count">{tab.count}</span>}
          </Link>
        ))}
      </nav>
    </header>
  );
}
