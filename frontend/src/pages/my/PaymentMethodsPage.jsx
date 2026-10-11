import { useState } from 'react';
import {
  createPaymentMethod,
  deletePaymentMethod,
  listPaymentMethods,
  setDefaultPaymentMethod,
} from './account.api.js';
import { PAYMENT_TYPE_LABEL, paymentMethodName } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { BankIcon, CardIcon, InfoIcon, WalletIcon } from './icons.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';

const TYPE_ICON = { CARD: CardIcon, BANK_ACCOUNT: BankIcon, EASY_PAY: WalletIcon };

function AddSheet({ onClose, onDone }) {
  const [form, setForm] = useState({
    methodType: 'CARD',
    providerName: '',
    last4: '',
    alias: '',
    isDefault: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const needsLast4 = form.methodType !== 'EASY_PAY';
  const valid = form.providerName.trim() && (!needsLast4 || /^\d{4}$/.test(form.last4));
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await createPaymentMethod({
        methodType: form.methodType,
        providerName: form.providerName.trim(),
        ...(form.last4 ? { last4: form.last4 } : {}),
        ...(form.alias.trim() ? { alias: form.alias.trim() } : {}),
        isDefault: form.isDefault,
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
        aria-label="결제수단 추가"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="ord-sheet__grip" />
        <h2 className="ord-sheet__title">결제수단 추가</h2>
        <p className="ord-sheet__sub">시연용이라 실제 번호는 받지 않고 뒤 4자리만 입력해요.</p>
        <div className="frm">
          <div className="ord-chips">
            {Object.entries(PAYMENT_TYPE_LABEL).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={form.methodType === value ? 'ord-chip is-active' : 'ord-chip'}
                onClick={() => setForm({ ...form, methodType: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="frm__field">
            <span>
              {form.methodType === 'BANK_ACCOUNT'
                ? '은행'
                : form.methodType === 'CARD'
                  ? '카드사'
                  : '간편결제 이름'}
            </span>
            <input
              value={form.providerName}
              onChange={set('providerName')}
              maxLength={50}
              placeholder={form.methodType === 'EASY_PAY' ? '토스페이' : '신한카드'}
            />
          </label>
          {needsLast4 ? (
            <label className="frm__field">
              <span>뒤 4자리</span>
              <input
                value={form.last4}
                onChange={(event) =>
                  setForm({ ...form, last4: event.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                inputMode="numeric"
                placeholder="1234"
              />
            </label>
          ) : null}
          <label className="frm__field">
            <span>별칭 (선택)</span>
            <input
              value={form.alias}
              onChange={set('alias')}
              maxLength={50}
              placeholder="생활비 카드"
            />
          </label>
          <label className="frm__check">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
            />
            기본 결제수단으로 설정
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

export default function PaymentMethodsPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const methods = useRequest(signedIn, 'payment-methods', listPaymentMethods);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setError('');
    try {
      await action();
      methods.reload();
    } catch (cause) {
      setError(cause.message);
    }
  };

  let body;
  if (methods.error) body = <ErrorNotice error={methods.error} onRetry={methods.reload} />;
  else if (!methods.data) body = <Loading />;
  else if (methods.data.items.length === 0)
    body = <p className="ord-empty">등록된 결제수단이 없어요</p>;
  else
    body = methods.data.items.map((method) => {
      const Icon = TYPE_ICON[method.method_type] ?? CardIcon;
      return (
        <article key={method.id} className={method.is_default ? 'pay-card is-default' : 'pay-card'}>
          <span className="pay-card__icon">
            <Icon />
          </span>
          <span className="pay-card__text">
            <strong>
              {paymentMethodName(method)}
              {method.is_default ? <span className="my-pill">기본</span> : null}
            </strong>
            <span>{method.alias || PAYMENT_TYPE_LABEL[method.method_type]}</span>
          </span>
          <span className="pay-card__actions">
            {method.is_default ? null : (
              <button type="button" onClick={() => run(() => setDefaultPaymentMethod(method.id))}>
                기본 설정
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                window.confirm('이 결제수단을 삭제할까요?') &&
                run(() => deletePaymentMethod(method.id))
              }
            >
              삭제
            </button>
          </span>
        </article>
      );
    });

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="결제수단 관리" />
      <p className="pay-banner">
        <InfoIcon /> 시연용 결제수단이에요. 실제 결제가 이뤄지지 않아요.
      </p>
      {error ? <p className="ord-sheet__error">{error}</p> : null}
      <div className="ord-list">{body}</div>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          onClick={() => setAdding(true)}
        >
          + 결제수단 추가
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
