import { StoreHeader } from '../../stores/components/StoreShell.jsx';
import BottomNavigation from '../../../components/BottomNavigation.jsx';
import '../../../App.css';
import './categoryDevelop.css';

export default function CategoryLayout({ children, embedded = false }) {
  if (embedded) return children;
  return <div className="app-shell category-develop-shell"><StoreHeader />{children}<BottomNavigation /></div>;
}
