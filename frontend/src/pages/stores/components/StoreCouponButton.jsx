import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { http } from '../../my/my.api.js';
import { couponConditions, couponHeadline, formatFullDate } from '../../my/accountFormat.js';
import { Sheet } from '../../common/CheckoutParts.jsx';
import CartAddedToast from '../../../components/CartAddedToast.jsx';
import Icon from './Icon.jsx';
import { useSession } from '../../my/hooks.js';
import { COUPON_MESSAGES, couponIssueMessage, issueWithRecovery, reconcileCouponIssue } from '../../common/couponSafety.js';
import '../../my/orders.css';
import '../../common/checkout.css';
import './storeCoupons.css';

export default function StoreCouponButton({ store }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lock = useRef(false);
  const noticeId = useRef(0);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);
  const [issueResults, setIssueResults] = useState([]);
  const { session } = useSession();
  const pendingKey = session ? `goodspang:coupon-issue:${session.user.id}:${store.id}` : null;
  const pendingMemory = useRef(null);
  const savePending = (requested) => {
    pendingMemory.current = requested;
    try { if (requested) localStorage.setItem(pendingKey, JSON.stringify(requested)); else localStorage.removeItem(pendingKey); } catch { /* optional storage */ }
    setPending(Boolean(requested));
  };
  const readCoupons = () => http.get(`/coupons/stores/${store.id}`).then(({ data }) => data.data);
  const syncCoupons = () => {
    void queryClient.invalidateQueries({ queryKey: ['cart'] });
    window.dispatchEvent(new Event('coupons-changed'));
  };
  const notify = (text) => { noticeId.current += 1; setNotice({ text, key: noticeId.current }); };
  const handleError = (error) => {
    if (error.status === 401) navigate('/login', { state: { from: `/stores/${store.id}` } });
    else notify(error.message || '쿠폰을 불러오지 못했습니다. 다시 시도해 주세요.');
  };
  useEffect(() => {
    if (!pendingKey) return undefined;
    let active = true;
    const refreshPending = async () => {
      if (lock.current) return;
      let requested;
      try { requested = JSON.parse(localStorage.getItem(pendingKey)); } catch { /* optional storage */ }
      if (!requested?.length) return;
      lock.current = true;
      try {
        const state = await http.get(`/coupons/stores/${store.id}`).then(({ data }) => data.data);
        if (!active) return;
        const result = reconcileCouponIssue(state, requested);
        setPending(result.pending);
        setItems((current) => current ? state.items : null);
        setIssueResults(result.results);
        if (!result.pending) localStorage.removeItem(pendingKey);
        noticeId.current += 1;
        setNotice({ text: couponIssueMessage(result), key: noticeId.current });
        void queryClient.invalidateQueries({ queryKey: ['cart'] });
        window.dispatchEvent(new Event('coupons-changed'));
      } catch {
        if (active) setPending(true);
      } finally { lock.current = false; }
    };
    void refreshPending();
    window.addEventListener('online', refreshPending);
    window.addEventListener('focus', refreshPending);
    return () => { active = false; window.removeEventListener('online', refreshPending); window.removeEventListener('focus', refreshPending); };
  }, [pendingKey, store.id, queryClient]);
  const recover = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      let requested = pendingMemory.current;
      try { requested = JSON.parse(localStorage.getItem(pendingKey)) ?? requested; } catch { /* optional storage */ }
      if (!requested) { notify(COUPON_MESSAGES.UNKNOWN); return; }
      let result = reconcileCouponIssue(await readCoupons(), requested);
      if (result.pending) result = await issueWithRecovery({
        issue: () => http.post(`/coupons/stores/${store.id}/issue`, { couponIds: requested.map((row) => row.id) }).then(({ data }) => data.data),
        read: readCoupons, requested,
      });
      setItems((current) => current ? result.items : null);
      setIssueResults(result.results);
      if (!result.pending) savePending(null);
      notify(couponIssueMessage(result)); syncCoupons();
    } catch (error) { handleError(error); }
    finally { lock.current = false; setBusy(false); }
  };
  const open = async () => {
    if (pending) return recover();
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const rows = (await readCoupons()).items;
      if (!rows.some((item) => !item.owned && !item.soldOut)) notify('받을 수 있는 쿠폰이 없습니다.');
      else { setItems(rows); setIssueResults([]); }
    } catch (error) { handleError(error); }
    finally { lock.current = false; setBusy(false); }
  };
  const issue = async (couponId = null) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const requested = items.filter((row) => !row.owned && (couponId ? row.id === couponId : !row.soldOut));
    savePending(requested);
    try {
      const result = await issueWithRecovery({
        issue: () => http.post(`/coupons/stores/${store.id}/issue`, { couponIds: requested.map((row) => row.id) }).then(({ data }) => data.data),
        read: readCoupons, requested,
      });
      setItems((current) => current ? result.items : null);
      setIssueResults(result.results ?? []);
      if (!result.pending) savePending(null);
      notify(couponIssueMessage(result)); syncCoupons();
    } catch (error) {
      if (!error.pending) savePending(null);
      handleError(error);
      // A definitive business rejection still refreshes the stale sheet.
      if (!error.pending && error.status !== 401) {
        try { const state = await readCoupons(); setItems((current) => current ? state.items : null); } catch { /* preserve list for retry */ }
      }
    }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <button type="button" className="store-coupon-button" onClick={open} disabled={busy}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z"/><path strokeDasharray="2 2" d="M15 5v14"/></svg>
      {busy ? '처리 중' : pending ? '발급 상태 확인' : '쿠폰받기'}
    </button>
    {items && <Sheet title="쿠폰 받기" sub={store.name} showClose onClose={() => setItems(null)}>
      <div className="store-coupon-list">
        {items.map((coupon) => <article className="store-coupon-card" key={coupon.id}>
          <div><strong>{couponHeadline({ coupon })} 할인</strong><p>{coupon.name}</p>
            <small>{couponConditions({ coupon: { ...coupon, store } })}</small>
            <small>{formatFullDate(coupon.valid_from)} ~ {formatFullDate(coupon.valid_until)}</small>
            <small>배송비 제외 상품금액 기준 · 매장 주문당 1장</small>
            {coupon.applies_to === 'ALL' && <small>픽업·배달 모두 사용 가능</small>}
          </div>
          <button type="button" disabled={busy || pending || coupon.owned || coupon.soldOut} onClick={() => issue(coupon.id)}>
            <span>{coupon.owned ? '받음' : coupon.soldOut ? '발급 마감' : '받기'}</span>
            {(coupon.owned || !coupon.soldOut) && <Icon name={coupon.owned ? 'check' : 'download'} size={16} />}
          </button>
        </article>)}
      </div>
      {issueResults.filter((row) => !['ISSUED', 'ALREADY_OWNED'].includes(row.status)).map((row) => <p className="ord-sheet__error" key={row.couponId}>{row.name} · {COUPON_MESSAGES[row.status]}</p>)}
      <button type="button" className="co-pay co-pay--sheet store-coupon-all" disabled={busy || (!pending && !items.some((item) => !item.owned && !item.soldOut))} onClick={() => pending ? recover() : issue()}>
        <span>{busy ? '발급 중…' : pending ? '발급 상태 다시 확인' : '쿠폰 모두 받기'}</span>
        {!busy && !pending && <Icon name="download" size={18} />}
      </button>
    </Sheet>}
    {notice && <CartAddedToast key={notice.key} text={notice.text} duration={2000} onClose={() => setNotice(null)} />}
  </>;
}
