import { useState } from 'react';
import { getMySellerApplication, submitSellerApplication } from './account.api.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { StoreIcon } from './icons.jsx';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';
import './support.css';

const POSTCODE_SRC = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const STATUS_TEXT = {
  PENDING: '심사 중이에요. 결과는 알림으로 알려드려요.',
  APPROVED: '입점이 승인되었어요.',
  REJECTED: '이전 신청이 반려되었어요. 내용을 고쳐 다시 신청할 수 있어요.',
};

function openPostcode(onComplete, onFail) {
  const open = () => new window.daum.Postcode({ oncomplete: onComplete }).open();
  if (window.daum?.Postcode) {
    open();
    return;
  }
  const script = document.createElement('script');
  script.src = POSTCODE_SRC;
  script.onload = open;
  script.onerror = onFail;
  document.head.appendChild(script);
}

function formatBusinessNo(value) {
  const d = value.replace(/\D/g, '').slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join('-');
}

function Field({ label, required = false, children }) {
  return (
    <label className="frm__field">
      <span>
        {label} {required ? <em>*</em> : null}
      </span>
      {children}
    </label>
  );
}

export default function SellerApplyPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const mine = useRequest(signedIn, 'seller-application', getMySellerApplication);
  const [form, setForm] = useState({
    storeName: '',
    ownerName: '',
    businessNo: '',
    address: '',
    phone: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const phoneDigits = form.phone.replace(/\D/g, '');
  const valid =
    form.storeName.trim() &&
    form.ownerName.trim() &&
    form.businessNo.replace(/\D/g, '').length === 10 &&
    form.address.trim() &&
    /^0\d{8,10}$/.test(phoneDigits);

  const search = () =>
    openPostcode(
      (data) => setForm((prev) => ({ ...prev, address: data.roadAddress || data.address })),
      () => setError('주소 검색을 불러오지 못했어요. 주소를 직접 입력해 주세요.')
    );

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await submitSellerApplication({
        storeName: form.storeName.trim(),
        ownerName: form.ownerName.trim(),
        businessNo: form.businessNo.replace(/\D/g, ''),
        address: form.address.trim(),
        phone: phoneDigits,
      });
      setSubmitted(true);
      mine.reload();
    } catch (cause) {
      setError(cause.message);
    }
    setBusy(false);
  };

  const application = mine.data?.application ?? null;
  const isSeller = mine.data && mine.data.role !== 'CONSUMER';
  const locked = submitted || isSeller || ['PENDING', 'APPROVED'].includes(application?.status);
  let status = null;
  if (isSeller) status = '이미 판매자 계정이에요.';
  else if (submitted) status = STATUS_TEXT.PENDING;
  else if (application) status = STATUS_TEXT[application.status] ?? null;

  let body;
  if (mine.error) body = <ErrorNotice error={mine.error} onRetry={mine.reload} />;
  else if (!mine.data) body = <Loading />;
  else
    body = (
      <>
        <div className="sel-notice">
          <StoreIcon />
          <div>
            <b>매장 정보를 알려주세요</b>
            <small>관리자 검수 후 1~3일 안에 결과를 알려드려요</small>
          </div>
        </div>
        {status ? <p className="sel-status">{status}</p> : null}
        <div className="frm sel-form">
          <Field label="매장명" required>
            <input
              value={form.storeName}
              placeholder="예: 굿즈하우스 서면점"
              disabled={locked}
              onChange={set('storeName')}
            />
          </Field>
          <Field label="대표자명" required>
            <input
              value={form.ownerName}
              placeholder="이름"
              disabled={locked}
              onChange={set('ownerName')}
            />
          </Field>
          <Field label="사업자등록번호" required>
            <input
              inputMode="numeric"
              value={form.businessNo}
              placeholder="000-00-00000"
              disabled={locked}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, businessNo: formatBusinessNo(event.target.value) }))
              }
            />
          </Field>
          <Field label="매장 주소" required>
            <div className="frm__row">
              <input
                value={form.address}
                placeholder="주소 검색"
                disabled={locked}
                onChange={set('address')}
              />
              <button type="button" className="frm__search" disabled={locked} onClick={search}>
                검색
              </button>
            </div>
          </Field>
          <Field label="매장 연락처" required>
            <input
              inputMode="tel"
              value={form.phone}
              placeholder="051-000-0000"
              disabled={locked}
              onChange={set('phone')}
            />
          </Field>
          {error ? <p className="ord-sheet__error">{error}</p> : null}
        </div>
        <footer className="ord-footer">
          <button
            type="button"
            className="ord-btn ord-btn--primary ord-btn--block"
            disabled={!valid || busy || locked}
            onClick={submit}
          >
            신청하기
          </button>
        </footer>
      </>
    );

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="입점 신청" />
      {body}
    </main>
  );
}
