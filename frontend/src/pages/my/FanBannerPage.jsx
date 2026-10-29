// 담당: 연수
import { useState } from 'react';
import {
  createFanBannerEntry,
  getFanBannerBoard,
  getMyPoints,
  listFanBannerEntries,
} from './account.api.js';
import { ErrorNotice, Loading, PageHeader } from './common.jsx';
import { useRequest, useRequireLogin } from './hooks.js';
import { formatWon } from './orderFormat.js';
import { MY_ROUTES } from './routes.js';
import './orders.css';
import './account.css';
import './mytab.css';

const STATUS_LABEL = {
  PENDING: '심사 대기',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  LIVE: '노출 중',
  ENDED: '종료',
};

function today() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ApplySheet({ unit, period, balance, onClose, onDone }) {
  const [form, setForm] = useState({
    title: '',
    characterName: '',
    message: '',
    requestedFrom: period.from < today() ? today() : period.from,
    requestedUntil: period.until < today() ? today() : period.until,
    amount: unit,
    payWith: 'MOCK',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const valid = form.title.trim() && form.requestedFrom <= form.requestedUntil;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await createFanBannerEntry({
        title: form.title.trim(),
        ...(form.characterName.trim() ? { characterName: form.characterName.trim() } : {}),
        ...(form.message.trim() ? { message: form.message.trim() } : {}),
        requestedFrom: form.requestedFrom,
        requestedUntil: form.requestedUntil,
        amount: form.amount,
        payWith: form.payWith,
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
        aria-label="응원배너 신청"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="ord-sheet__grip" />
        <h2 className="ord-sheet__title">응원배너 신청</h2>
        <p className="ord-sheet__sub">
          같은 기간에 가장 높은 금액을 건 배너가 선정돼요. 선정되지 않으면 금액은 돌려받아요.
        </p>
        <div className="frm">
          <label className="frm__field">
            <span>배너 제목</span>
            <input value={form.title} maxLength={50} onChange={set('title')} />
          </label>
          <label className="frm__field">
            <span>응원할 캐릭터 (선택)</span>
            <input value={form.characterName} maxLength={50} onChange={set('characterName')} />
          </label>
          <label className="frm__field">
            <span>응원 문구 (선택)</span>
            <input value={form.message} maxLength={200} onChange={set('message')} />
          </label>
          <label className="frm__field">
            <span>노출 시작일</span>
            <input
              type="date"
              min={today()}
              value={form.requestedFrom}
              onChange={set('requestedFrom')}
            />
          </label>
          <label className="frm__field">
            <span>노출 종료일</span>
            <input
              type="date"
              min={form.requestedFrom}
              value={form.requestedUntil}
              onChange={set('requestedUntil')}
            />
          </label>
          <div className="frm__field">
            <span>신청 금액 ({unit.toLocaleString()}원 단위)</span>
            <div className="ord-chips">
              <button
                type="button"
                className="ord-chip"
                disabled={form.amount <= unit}
                onClick={() => setForm({ ...form, amount: form.amount - unit })}
              >
                -
              </button>
              <strong className="mt-amount">{formatWon(form.amount)}</strong>
              <button
                type="button"
                className="ord-chip"
                onClick={() => setForm({ ...form, amount: form.amount + unit })}
              >
                +
              </button>
              <button
                type="button"
                className="ord-chip"
                onClick={() => setForm({ ...form, amount: form.amount + unit * 10 })}
              >
                +{(unit * 10).toLocaleString()}
              </button>
            </div>
          </div>
          <div className="frm__field">
            <span>결제 방식</span>
            <div className="ord-chips">
              <button
                type="button"
                className={form.payWith === 'MOCK' ? 'ord-chip is-active' : 'ord-chip'}
                onClick={() => setForm({ ...form, payWith: 'MOCK' })}
              >
                모의결제
              </button>
              <button
                type="button"
                className={form.payWith === 'POINT' ? 'ord-chip is-active' : 'ord-chip'}
                onClick={() => setForm({ ...form, payWith: 'POINT' })}
              >
                적립금 ({formatWon(balance)})
              </button>
            </div>
          </div>
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
            {formatWon(form.amount)} 신청하기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FanBannerPage() {
  const signedIn = useRequireLogin(MY_ROUTES.login);
  const board = useRequest(signedIn, 'fan-board', () => getFanBannerBoard());
  const mine = useRequest(signedIn, 'fan-mine', listFanBannerEntries);
  const points = useRequest(signedIn, 'fan-points', getMyPoints);
  const [applying, setApplying] = useState(false);

  const reloadAll = () => {
    board.reload();
    mine.reload();
    points.reload();
  };

  let body;
  const error = board.error ?? mine.error;
  if (error) body = <ErrorNotice error={error} onRetry={reloadAll} />;
  else if (!board.data || !mine.data) body = <Loading />;
  else
    body = (
      <>
        <section className="mt-hero">
          <p className="mt-hero__label">이번주 최애 응원배너</p>
          <p className="mt-hero__value">
            {board.data.period.from.slice(5).replace('-', '.')} ~{' '}
            {board.data.period.until.slice(5).replace('-', '.')}
          </p>
          <p className="mt-hero__sub">
            응원하고 싶은 캐릭터 배너에 원하는 금액을 걸어 보세요. 같은 기간에 가장 높은 금액의
            배너가 홈에 걸리고, 선정되지 않은 신청은 금액을 돌려받아요.
          </p>
        </section>
        <h2 className="mt-h">현재 순위</h2>
        {board.data.entries.length === 0 ? (
          <p className="ord-empty">아직 신청이 없어요. 첫 번째로 신청해 보세요!</p>
        ) : (
          board.data.entries.map((entry) => (
            <div key={entry.id} className="mt-row">
              <span className={entry.rank === 1 ? 'mt-rank is-top' : 'mt-rank'}>{entry.rank}</span>
              <div className="mt-row__main">
                <strong className={entry.isMine ? 'mt-mine' : undefined}>{entry.title}</strong>
                <span>
                  {entry.characterName ?? '캐릭터 미지정'} · {entry.nickname}
                  {entry.isMine ? ' (나)' : ''}
                </span>
              </div>
              <span className="mt-amount">{formatWon(entry.amount)}</span>
            </div>
          ))
        )}
        <h2 className="mt-h">내 신청 내역</h2>
        {mine.data.items.length === 0 ? (
          <p className="ord-empty">신청한 내역이 없어요</p>
        ) : (
          mine.data.items.map((entry) => (
            <div key={entry.id} className="mt-row">
              <div className="mt-row__main">
                <strong>{entry.title}</strong>
                <span>
                  {entry.requestedFrom} ~ {entry.requestedUntil}
                  {entry.rejectReason ? ` · ${entry.rejectReason}` : ''}
                </span>
              </div>
              <span className="mt-amount">{formatWon(entry.amount)}</span>
              <span className="ord-pill ord-pill--soft">
                {STATUS_LABEL[entry.status] ?? entry.status}
              </span>
            </div>
          ))
        )}
      </>
    );

  return (
    <main className="ord-page ord-page--fab">
      <PageHeader title="이번주 최애 배너" />
      {body}
      <footer className="ord-footer">
        <button
          type="button"
          className="ord-btn ord-btn--primary ord-btn--block"
          disabled={!board.data}
          onClick={() => setApplying(true)}
        >
          응원배너 신청하기
        </button>
      </footer>
      {applying && board.data ? (
        <ApplySheet
          unit={board.data.bidUnit}
          period={board.data.period}
          balance={points.data?.balance ?? 0}
          onClose={() => setApplying(false)}
          onDone={() => {
            setApplying(false);
            reloadAll();
          }}
        />
      ) : null}
    </main>
  );
}
