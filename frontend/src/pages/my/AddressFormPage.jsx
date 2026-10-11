import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createAddress, listAddresses, updateAddress } from './account.api.js';
import { formatPhone } from './accountFormat.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';

const POSTCODE_SRC = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const REQUEST_PRESETS = [
  ['문 앞', '문 앞에 놓아주세요'],
  ['경비실', '경비실에 맡겨주세요'],
  ['직접 받기', '직접 받을게요'],
];

// 카카오(다음) 우편번호 검색창을 연다. 스크립트를 못 불러오면 onFail로 직접 입력을 허용한다.
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

function requestChip(value) {
  if (!value) return REQUEST_PRESETS[0][0];
  const preset = REQUEST_PRESETS.find(([, text]) => text === value);
  return preset ? preset[0] : '직접 입력';
}

function AddressForm({ initial, onSaved }) {
  const editing = Boolean(initial);
  const [form, setForm] = useState({
    label: initial?.label ?? '',
    recipientName: initial?.recipient_name ?? '',
    recipientPhone: initial ? formatPhone(initial.recipient_phone) : '',
    zipCode: initial?.zip_code ?? '',
    roadAddress: initial?.road_address ?? '',
    detailAddress: initial?.detail_address ?? '',
    chip: requestChip(initial?.delivery_request ?? ''),
    customRequest:
      initial && requestChip(initial.delivery_request) === '직접 입력'
        ? initial.delivery_request
        : '',
    isDefault: initial?.is_default ?? true,
  });
  const [manual, setManual] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const deliveryRequest =
    form.chip === '직접 입력'
      ? form.customRequest.trim()
      : (REQUEST_PRESETS.find(([label]) => label === form.chip)?.[1] ?? '');
  const phoneDigits = form.recipientPhone.replace(/\D/g, '');
  const valid =
    form.recipientName.trim() &&
    /^0\d{9,10}$/.test(phoneDigits) &&
    /^\d{5}$/.test(form.zipCode) &&
    form.roadAddress.trim() &&
    form.detailAddress.trim();

  const search = () =>
    openPostcode(
      (data) =>
        setForm((prev) => ({
          ...prev,
          zipCode: data.zonecode,
          roadAddress: data.roadAddress || data.address,
        })),
      () => {
        setManual(true);
        setError('주소 검색을 불러오지 못했어요. 우편번호와 주소를 직접 입력해 주세요.');
      }
    );

  const save = async () => {
    setBusy(true);
    setError('');
    const body = {
      recipientName: form.recipientName.trim(),
      recipientPhone: phoneDigits,
      zipCode: form.zipCode,
      roadAddress: form.roadAddress.trim(),
      detailAddress: form.detailAddress.trim(),
      isDefault: form.isDefault,
      ...(editing || form.label.trim() ? { label: form.label.trim() || null } : {}),
      ...(editing || deliveryRequest ? { deliveryRequest: deliveryRequest || null } : {}),
    };
    try {
      if (editing) await updateAddress(initial.id, body);
      else await createAddress(body);
      onSaved();
    } catch (cause) {
      setError(cause.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="frm frm--page">
        <label className="frm__field">
          <span>배송지명</span>
          <input value={form.label} onChange={set('label')} maxLength={50} placeholder="집" />
        </label>
        <label className="frm__field">
          <span>
            받는 사람 <b className="ord-required">*</b>
          </span>
          <input value={form.recipientName} onChange={set('recipientName')} maxLength={50} />
        </label>
        <label className="frm__field">
          <span>
            연락처 <b className="ord-required">*</b>
          </span>
          <input
            value={form.recipientPhone}
            onChange={set('recipientPhone')}
            inputMode="tel"
            placeholder="010-1234-5678"
          />
        </label>
        <div className="frm__field">
          <span>
            주소 <b className="ord-required">*</b>
          </span>
          <div className="frm__row">
            <input
              className="is-ro"
              value={form.zipCode}
              readOnly={!manual}
              onChange={set('zipCode')}
              placeholder="우편번호"
            />
            <button type="button" className="frm__search" onClick={search}>
              주소 검색
            </button>
          </div>
          <input
            className="is-ro"
            value={form.roadAddress}
            readOnly={!manual}
            onChange={set('roadAddress')}
            placeholder="도로명 주소"
          />
          <input
            value={form.detailAddress}
            onChange={set('detailAddress')}
            maxLength={100}
            placeholder="상세 주소"
          />
        </div>
        <div className="frm__field">
          <span>배달 요청사항</span>
          <div className="ord-chips">
            {[...REQUEST_PRESETS.map(([label]) => label), '직접 입력'].map((label) => (
              <button
                key={label}
                type="button"
                className={form.chip === label ? 'ord-chip is-active' : 'ord-chip'}
                onClick={() => setForm({ ...form, chip: label })}
              >
                {label}
              </button>
            ))}
          </div>
          {form.chip === '직접 입력' ? (
            <input
              value={form.customRequest}
              onChange={set('customRequest')}
              maxLength={200}
              placeholder="요청사항을 입력해 주세요"
            />
          ) : null}
        </div>
        <label className="frm__check">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
          />
          기본 배송지로 설정
        </label>
        {error ? <p className="ord-sheet__error">{error}</p> : null}
      </div>
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          disabled={!valid || busy}
          onClick={save}
        >
          저장
        </button>
      </footer>
    </>
  );
}

export default function AddressFormPage() {
  const { addressId } = useParams();
  const navigate = useNavigate();
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const addresses = useRequest(
    signedIn && Boolean(addressId),
    `address-form:${addressId}`,
    listAddresses
  );
  const initial = addresses.data?.items.find((item) => item.id === addressId);

  let body;
  if (addressId && addresses.error)
    body = <ErrorNotice error={addresses.error} onRetry={addresses.reload} />;
  else if (addressId && !addresses.data) body = <Loading />;
  else if (addressId && !initial) body = <p className="ord-empty">배송지를 찾지 못했어요</p>;
  else
    body = (
      <AddressForm
        initial={initial}
        onSaved={() => navigate(MY_ROUTES.addresses, { replace: true })}
      />
    );

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title={addressId ? '배송지 수정' : '배송지 추가'} />
      {body}
    </main>
  );
}
