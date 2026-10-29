// 빈 상태 (C-03) · 로그인 안내
// 담당: 동균
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';

export default function CartEmptyState({ type }) {
  return (
    <div className="cart-state">
      <span className="cart-state-icon">
        <Icon name="cart" size={30} />
      </span>
      <p>{type === 'PICKUP' ? '픽업할 상품이 없어요' : '배달할 상품이 없어요'}</p>
      <Link className="cart-state-button" to="/wish">
        찜 목록에서 담기
      </Link>
    </div>
  );
}

export function CartLoginRequired({ returnTo }) {
  return (
    <div className="cart-state">
      <span className="cart-state-icon">
        <Icon name="user" size={30} />
      </span>
      <p>로그인이 필요합니다</p>
      <Link className="cart-state-button" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        로그인하러 가기
      </Link>
    </div>
  );
}
