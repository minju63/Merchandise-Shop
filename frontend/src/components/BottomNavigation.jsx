import { NavLink } from 'react-router-dom';
import Icon from './Icon.jsx';
import './BottomNavigation.css';

const tabs = [
  { icon: 'home', label: '홈', to: '/' },
  { icon: 'store', label: '굿즈샵', to: '/stores' },
  { icon: 'grid', label: '카테고리' },
  { icon: 'heart', label: '찜' },
  { icon: 'user', label: '마이' },
];

export default function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="하단 메뉴">
      {tabs.map(({ icon, label, to }) => to ? (
        <NavLink
          key={label}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `bottom-navigation__item${isActive ? ' is-active' : ''}`}
          aria-label={label}
        >
          <Icon name={icon} size={23} />
          <span>{label}</span>
        </NavLink>
      ) : (
        <button
          key={label}
          className="bottom-navigation__item"
          type="button"
          disabled
          title={`${label} 화면 준비 중`}
          aria-label={`${label} 화면 준비 중`}
        >
          <Icon name={icon} size={23} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
