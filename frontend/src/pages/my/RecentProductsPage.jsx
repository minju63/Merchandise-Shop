// 담당: 연수
import { useNavigate } from 'react-router-dom';
import { getRecentProducts } from './account.api.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './mytab.css';

export default function RecentProductsPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const recent = useRequest(signedIn, 'recent-products', getRecentProducts);
  const items = recent.data?.items ?? [];

  let body;
  if (recent.error) body = <ErrorNotice error={recent.error} onRetry={recent.reload} />;
  else if (!recent.data) body = <Loading />;
  else if (items.length === 0)
    body = <p className="ord-empty">최근 {recent.data.days}일 동안 본 상품이 없어요</p>;
  else
    body = (
      <div className="mt-grid">
        {items.map((item) => {
          const available = Boolean(item.storeProductId);
          return (
            <button
              key={item.productId}
              type="button"
              className={available ? 'mt-product' : 'mt-product is-off'}
              disabled={!available}
              onClick={() => navigate(MY_ROUTES.product(item.storeProductId))}
            >
              <Thumb src={item.thumbnailUrl} size={160} />
              <strong>{item.name}</strong>
              <span>
                {available ? `${formatWon(item.lowestPrice)}~` : '판매 중인 매장이 없어요'}
              </span>
            </button>
          );
        })}
      </div>
    );

  return (
    <main className="ord-page">
      <PageHeader title="최근 본 상품" />
      <p className="mt-notice">최근 {recent.data?.days ?? 14}일 동안 본 상품만 보여요.</p>
      {body}
    </main>
  );
}
