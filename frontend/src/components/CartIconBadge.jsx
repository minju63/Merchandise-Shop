import { useQuery } from '@tanstack/react-query';
import { cartApi } from '../api/cart.api.js';
import { useSession } from '../pages/my/hooks.js';
import Icon from './Icon.jsx';
import './CartIconBadge.css';

export default function CartIconBadge({ size = 22, icon = null, className = '' }) {
  const { status, session } = useSession();
  const counts = useQuery({
    queryKey: ['cart', 'counts', session?.user?.id],
    queryFn: cartApi.counts,
    enabled: status === 'in' && Boolean(session?.user?.id),
    retry: false,
  });
  const count = Number(counts.data?.data?.total ?? 0);

  return (
    <span className={`cart-icon-badge ${className}`.trim()}>
      {icon ?? <Icon name="cart" size={size} />}
      {count > 0 ? (
        <span className="cart-icon-badge__count" aria-label={`장바구니 상품 ${count}개`}>
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </span>
  );
}
