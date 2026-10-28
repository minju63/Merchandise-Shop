import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  changeOrderAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
} from './account.api.js';
import { formatPhone } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';

export default function AddressesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const pickForOrderId = location.state?.orderId ?? null;
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const addresses = useRequest(signedIn, 'addresses', listAddresses);
  const [error, setError] = useState('');

  const run = async (action) => {
    setError('');
    try {
      await action();
      addresses.reload();
    } catch (cause) {
      setError(cause.message);
    }
  };

  const choose = async (address) => {
    setError('');
    try {
      await changeOrderAddress(pickForOrderId, address.id);
      navigate(MY_ROUTES.orderDetail(pickForOrderId), { replace: true });
    } catch (cause) {
      setError(cause.message);
    }
  };

  const items = addresses.data?.items ?? [];
  const max = addresses.data?.maxAddresses ?? 10;

  let body;
  if (addresses.error) body = <ErrorNotice error={addresses.error} onRetry={addresses.reload} />;
  else if (!addresses.data) body = <Loading />;
  else if (items.length === 0) body = <p className="ord-empty">등록된 배송지가 없어요</p>;
  else
    body = items.map((address) => (
      <article key={address.id} className={address.is_default ? 'adr-card is-default' : 'adr-card'}>
        <p className="adr-card__label">
          {address.label || '배송지'}
          {address.is_default ? <span className="my-pill">기본 배송지</span> : null}
        </p>
        <p className="adr-card__who">
          {address.recipient_name} · {formatPhone(address.recipient_phone)}
        </p>
        <p className="adr-card__line">
          ({address.zip_code}) {address.road_address} {address.detail_address}
        </p>
        {address.delivery_request ? (
          <p className="adr-card__req">{address.delivery_request}</p>
        ) : null}
        <div className="ord-actions">
          {pickForOrderId ? (
            <button
              type="button"
              className="ord-btn ord-btn--primary ord-btn--grow"
              onClick={() => choose(address)}
            >
              이 배송지로 변경
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ord-btn ord-btn--small"
                onClick={() => navigate(MY_ROUTES.addressEdit(address.id))}
              >
                수정
              </button>
              <button
                type="button"
                className="ord-btn ord-btn--small"
                onClick={() =>
                  window.confirm('이 배송지를 삭제할까요?') && run(() => deleteAddress(address.id))
                }
              >
                삭제
              </button>
              {address.is_default ? null : (
                <button
                  type="button"
                  className="adr-card__link"
                  onClick={() => run(() => setDefaultAddress(address.id))}
                >
                  기본으로 설정
                </button>
              )}
            </>
          )}
        </div>
      </article>
    ));

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader
        title={pickForOrderId ? '배송지 선택' : '배송지 관리'}
        right={
          addresses.data ? (
            <span className="adr-count">
              {items.length} / {max}
            </span>
          ) : null
        }
      />
      {error ? <p className="ord-sheet__error">{error}</p> : null}
      <div className="ord-list">{body}</div>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          disabled={items.length >= max}
          onClick={() => navigate(MY_ROUTES.addressNew)}
        >
          + 배송지 추가
        </button>
      </footer>
    </main>
  );
}
