// 담당: 연수
import { useState } from 'react';
import { createPaymentMethod, deletePaymentMethod, listPaymentMethods } from './account.api.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { BankIcon, InfoIcon } from './icons.jsx';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';
import './mytab.css';

function AddSheet({ onClose, onDone }) {
  const [form, setForm] = useState({ bank: '', last4: '', holder: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = form.bank.trim() && /^\d{4}$/.test(form.last4) && form.holder.trim();

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await createPaymentMethod({
        methodType: 'BANK_ACCOUNT',
        providerName: form.bank.trim(),
        last4: form.last4,
        alias: form.holder.trim(),
      });
      onDone();
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  return (
    <div className="ord-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ord-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="환불계좌 추가"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="ord-sheet__grip" />
        <h2 className="ord-sheet__title">환불계좌 추가</h2>
        <p className="ord-sheet__sub">시연용이라 계좌번호 전체는 받지 않고 뒤 4자리만 입력해요.</p>
        <div className="frm">
          <label className="frm__field">
            <span>은행</span>
            <input
              value={form.bank}
              maxLength={50}
              placeholder="국민은행"
              onChange={(event) => setForm({ ...form, bank: event.target.value })}
            />
          </label>
          <label className="frm__field">
            <span>계좌번호 뒤 4자리</span>
            <input
              value={form.last4}
              inputMode="numeric"
              placeholder="1234"
              onChange={(event) =>
                setForm({ ...form, last4: event.target.value.replace(/\D/g, '').slice(0, 4) })
              }
            />
          </label>
          <label className="frm__field">
            <span>예금주</span>
            <input
              value={form.holder}
              maxLength={50}
              placeholder="홍길동"
              onChange={(event) => setForm({ ...form, holder: event.target.value })}
            />
          </label>
        </div>
        {error ? <p className="ord-sheet__error">{error}</p> : null}
        <div className="ord-sheet__actions">
          <button type="button" className="ord-btn" onClick={onClose}>
            닫기
          </button>
          <button
            type="button"
            className="ord-btn ord-btn--primary"
            disabled={!valid || busy}
            onClick={submit}
          >
            추가하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RefundAccountsPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const methods = useRequest(signedIn, 'refund-accounts', listPaymentMethods);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const accounts = (methods.data?.items ?? []).filter(
    (item) => item.method_type === 'BANK_ACCOUNT'
  );

  const remove = async (account) => {
    if (!window.confirm('이 환불계좌를 삭제할까요?')) return;
    setError('');
    try {
      await deletePaymentMethod(account.id);
      methods.reload();
    } catch (cause) {
      setError(cause.message);
    }
  };

  let body;
  if (methods.error) body = <ErrorNotice error={methods.error} onRetry={methods.reload} />;
  else if (!methods.data) body = <Loading />;
  else if (accounts.length === 0) body = <p className="ord-empty">등록된 환불계좌가 없어요</p>;
  else
    body = accounts.map((account) => (
      <article key={account.id} className="pay-card">
        <span className="pay-card__icon">
          <BankIcon />
        </span>
        <span className="pay-card__text">
          <strong>
            {account.provider_name} ****{account.last4}
          </strong>
          <span>예금주 {account.alias ?? '-'}</span>
        </span>
        <span className="pay-card__actions">
          <button type="button" onClick={() => remove(account)}>
            삭제
          </button>
        </span>
      </article>
    ));

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="환불계좌 관리" />
      <p className="pay-banner">
        <InfoIcon /> 반품 환불을 받을 계좌예요. 결제수단 관리의 계좌와 같이 관리돼요.
      </p>
      {error ? <p className="ord-sheet__error">{error}</p> : null}
      <div className="ord-list">{body}</div>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          onClick={() => setAdding(true)}
        >
          + 환불계좌 추가
        </button>
      </footer>
      {adding ? (
        <AddSheet
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            methods.reload();
          }}
        />
      ) : null}
    </main>
  );
}
