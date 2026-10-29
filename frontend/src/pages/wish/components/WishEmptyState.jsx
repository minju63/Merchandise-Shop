// 빈 상태 (J-08) · 로그인 안내
// 담당: 동균
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';

const emptyCopy = {
  products: { message: '찜한 상품이 없습니다', action: '굿즈 둘러보기', to: '/category' },
  shops: { message: '찜한 굿즈샵이 없습니다', action: '굿즈샵 둘러보기', to: '/stores' },
};

export default function WishEmptyState({ type }) {
  const { message, action, to } = emptyCopy[type];
  return (
    <div className="wish-state">
      <span className="wish-state-icon">
        <Icon name="heart" size={30} />
      </span>
      <p>{message}</p>
      <Link className="wish-state-button" to={to}>
        {action}
      </Link>
    </div>
  );
}

export function WishLoginRequired({ returnTo }) {
  return (
    <div className="wish-state">
      <span className="wish-state-icon">
        <Icon name="user" size={30} />
      </span>
      <p>로그인이 필요합니다</p>
      <Link className="wish-state-button" to={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        로그인하러 가기
      </Link>
    </div>
  );
}
