// 담당: 연수
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClaim, listPaymentMethods } from './account.api.js';
import { paymentMethodName } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader, Thumb } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { getOrder } from './my.api.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';
import './mytab.css';

const REASONS = [
  ['DEFECT', '상품에 문제가 있어요'],
  ['WRONG_ITEM', '다른 상품이 왔어요'],
  ['NOT_AS_DESCRIBED', '설명과 달라요'],
  ['CHANGE_OF_MIND', '단순 변심이에요'],
  ['ETC', '기타'],
];

export default function ClaimFormPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const order = useRequest(signedIn, `claim-order-${orderId}`, () => getOrder(orderId));
  const methods = useRequest(signedIn, 'claim-methods', listPaymentMethods);
  const [itemId, setItemId] = useState('');
  const [claimType, setClaimType] = useState('RETURN');
  const [reason, setReason] = useState('DEFECT');
  const [detail, setDetail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const items = order.data?.items ?? [];
  const accounts = (methods.data?.items ?? []).filter((m) => m.method_type === 'BANK_ACCOUNT');
  const valid = itemId && (reason !== 'ETC' || detail.trim());

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await createClaim(orderId, {
        orderItemId: itemId,
        claimType,
        reason,
        ...(detail.trim() ? { detail: detail.trim() } : {}),
        ...(claimType === 'RETURN' && accountId ? { refundPaymentMethodId: accountId } : {}),
      });
      navigate(MY_ROUTES.claims, { replace: true });
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  let body;
  if (order.error) body = <ErrorNotice error={order.error} onRetry={order.reload} />;
  else if (!order.data) body = <Loading />;
  else
    body = (
      <div className="frm frm--page">
        <div className="frm__field">
          <span>신청할 상품</span>
          <div className="mt-select">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={itemId === item.id ? 'mt-option is-active' : 'mt-option'}
                onClick={() => setItemId(item.id)}
              >
                <Thumb src={item.product_image_url} size={48} />
                <span className="mt-row__main">
                  <strong>{item.product_name}</strong>
                  <span>
                    {item.quantity}개 · {formatWon(item.unit_price * item.quantity)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="frm__field">
          <span>신청 종류</span>
          <div className="ord-chips">
            {[
              ['RETURN', '반품'],
              ['EXCHANGE', '교환'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={claimType === value ? 'ord-chip is-active' : 'ord-chip'}
                onClick={() => setClaimType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="frm__field">
          <span>사유</span>
          <div className="mt-select">
            {REASONS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={reason === value ? 'mt-option is-active' : 'mt-option'}
                onClick={() => setReason(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="mt-textarea"
            value={detail}
            maxLength={500}
            placeholder={reason === 'ETC' ? '사유를 입력해 주세요 (필수)' : '자세한 내용 (선택)'}
            onChange={(event) => setDetail(event.target.value)}
          />
        </div>
        {claimType === 'RETURN' ? (
          <div className="frm__field">
            <span>환불계좌 (선택)</span>
            {accounts.length === 0 ? (
              <button
                type="button"
                className="ord-btn"
                onClick={() => navigate(MY_ROUTES.refundAccounts)}
              >
                환불계좌 등록하러 가기
              </button>
            ) : (
              <div className="mt-select">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    className={accountId === account.id ? 'mt-option is-active' : 'mt-option'}
                    onClick={() => setAccountId(accountId === account.id ? '' : account.id)}
                  >
                    {paymentMethodName(account)}
                    {account.alias ? ` · ${account.alias}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
        {error ? <p className="mt-error">{error}</p> : null}
      </div>
    );

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="반품·교환 신청" />
      {body}
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          disabled={!valid || busy}
          onClick={submit}
        >
          신청하기
        </button>
      </footer>
    </main>
  );
}
