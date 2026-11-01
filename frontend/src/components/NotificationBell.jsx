import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import './NotificationBell.css';

export default function NotificationBell({ className = '', iconSize = 21, count = 0 }) {
  return (
    <Link className={`notification-bell ${className}`.trim()} to="/notifications" aria-label={`알림 ${count}개`}>
      <Icon name="bell" size={iconSize} />
      {count > 0 && <span className="notification-bell__badge">{count}</span>}
    </Link>
  );
}
