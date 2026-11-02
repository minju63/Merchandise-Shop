// 담당: 연수
import { Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { getMySellerApplication } from './account.api.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { StoreIcon } from './icons.jsx';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './help.css';

// 입점 승인된 판매자가 매장별 진열장을 관리하는 진입 화면.
export default function SellerCenterPage() {
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const mine = useRequest(signedIn, 'seller-center', getMySellerApplication);

  if (mine.data && !mine.data.canEnterSellerCenter) {
    return <Navigate to={MY_ROUTES.sellerApply} replace />;
  }

  let body;
  if (mine.error) body = <ErrorNotice error={mine.error} onRetry={mine.reload} />;
  else if (!mine.data) body = <Loading />;
  else {
    const stores = mine.data.stores ?? [];
    body =
      stores.length === 0 ? (
        <p className="ord-empty">등록된 매장이 없어요</p>
      ) : (
        <div className="hlp-list">
          {stores.map((store) => (
            <article key={store.id} className="hlp-card">
              <span className="hlp-card__meta">
                <StoreIcon /> 내 굿즈샵
              </span>
              <strong className="hlp-card__title" style={{ marginTop: 8 }}>
                {store.name}
              </strong>
              {store.address ? <p className="hlp-card__text">{store.address}</p> : null}
              <button type="button" className="showcase-primary" onClick={() => navigate(`/my/seller-center/stores/${store.id}/showcases`)}>내 진열장 관리</button>
            </article>
          ))}
        </div>
      );
  }

  return (
    <main className="ord-page">
      <PageHeader title="판매자 센터" />
      {body}
    </main>
  );
}
