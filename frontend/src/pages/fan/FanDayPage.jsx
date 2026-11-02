import { useState } from 'react';
import { DetailSection, DetailShell } from '../home/BannerDetailParts.jsx';
import { congratsTime, dayParts, dayTitle, eventWord, kstToday } from './fanDayFormat.js';
import './FanDay.css';

const CONGRATS_MAX = 50;

function HeartIcon({ on }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8c0 5.5-7.5 10.1-7.5 10.1Z" />
    </svg>
  );
}

function Avatar({ item, size = 'md' }) {
  return (
    <span className={`fd-avatar fd-avatar--${size}`}>
      {item.imageUrl ? <img src={item.imageUrl} alt="" /> : item.name.slice(0, 1)}
    </span>
  );
}

const cheerSub = (item) => [item.workTitle, `응원 ${item.cheerCount.toLocaleString('ko-KR')}회`].filter(Boolean).join(' · ');
const congratsLine = (item, birthdayOnly) => `${item.name}, ${birthdayOnly || item.kind === 'BIRTHDAY' ? '생일 ' : ''}축하해!`;

function CheerQuote({ item }) {
  if (!item.cheerMessage) return null;
  return (
    <p className="fd-quote">
      “{item.cheerMessage}”
      {item.cheerNickname ? <span> — {item.cheerNickname}</span> : null}
    </p>
  );
}

function Actions({ item, busy, onLike, onGoods }) {
  return (
    <div className="fd-actions">
      <button type="button" className={`fd-btn fd-btn--like${item.liked ? ' is-on' : ''}`} disabled={busy} aria-pressed={item.liked} onClick={() => onLike(item)}>
        <HeartIcon on={item.liked} /> 축하하기
      </button>
      <button type="button" className="fd-btn" onClick={() => onGoods(item)}>생일 굿즈 보기</button>
    </div>
  );
}

// 홈 4번 기념일 전광판을 누르면 열리는 "오늘 기념일인 최애 모아보기" (/fan-banner/day/:date)
export default function FanDayPage({
  date, board, error, loggedIn, busy, congratsNotice, congratsError, posting,
  onBack, onRetry, onLike, onGoods, onGoodsAll, onSubmitCongrats, onUpdateCongrats, onDeleteCongrats,
}) {
  const [picked, setPicked] = useState(null);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  const ranked = board?.ranked ?? [];
  const others = board?.others ?? [];
  const winner = ranked.find((item) => item.isWinner) ?? ranked[0] ?? null;
  const rivals = ranked.filter((item) => item !== winner);
  const everyone = [...ranked, ...others];
  const word = eventWord(board?.birthdayOnly ?? true);
  const { year, month, day } = dayParts(date);
  const dateLine = `${year}. ${String(month).padStart(2, '0')}. ${String(day).padStart(2, '0')} · ${board?.birthdayOnly === false ? 'ANNIVERSARY' : 'BIRTHDAY'}`;
  const selectedId = picked ?? winner?.characterId ?? everyone[0]?.characterId ?? null;
  const selected = everyone.find((item) => item.characterId === selectedId) ?? null;
  const onlyOne = Boolean(winner) && rivals.length === 0 && others.length === 0;

  const submit = async () => {
    if (!selected || !text.trim()) return;
    const ok = await onSubmitCongrats({ characterId: selected.characterId, message: text.trim() });
    if (ok) setText('');
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setEditText(entry.message);
  };
  const saveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const ok = await onUpdateCongrats({ id: editingId, message: editText.trim() });
    if (ok) {
      setEditingId(null);
      setEditText('');
    }
  };
  const remove = async (entry) => {
    if (!window.confirm('이 축하 한마디를 삭제할까요?')) return;
    const ok = await onDeleteCongrats(entry.id);
    if (ok && editingId === entry.id) {
      setEditingId(null);
      setEditText('');
    }
  };

  const goods = (item) => {
    setPicked(item.characterId);
    onGoods(item);
  };
  const like = (item) => {
    setPicked(item.characterId);
    onLike(item);
  };

  return (
    <DetailShell
      title={dayTitle(date, board?.birthdayOnly ?? true)}
      ready={Boolean(board)}
      error={error}
      onBack={onBack}
      onRetry={onRetry}
      hero={board ? (
        <section className="fd-hero">
          <span className="fd-hero__date">{dateLine}</span>
          <h2>{board.birthdayOnly === false ? 'HAPPY ANNIVERSARY' : 'HAPPY BIRTHDAY'}</h2>
          <p className="fd-hero__lead">
            {date === kstToday() ? '오늘' : `${month}월 ${day}일`} {word}인 최애 모두, {word} 축하해요!
          </p>
          {winner ? (
            <p className="fd-hero__desc">
              메인 전광판에는 응원 1위 최애가 올라갔지만, 오늘은 {word}을 맞은 최애 모두를 함께 축하해요.
            </p>
          ) : null}
        </section>
      ) : null}
      footer={board ? (
        <button
          className="bd__btn"
          type="button"
          onClick={() => onGoodsAll(selected)}
        >
          {month}월 {word} 최애 굿즈 보러 가기
        </button>
      ) : null}
    >
      {board ? (
        <>
          {everyone.length === 0 ? (
            <DetailSection>
              <p className="fd-empty">이 날은 {word}인 최애가 없어요.</p>
            </DetailSection>
          ) : null}

          {winner ? (
            <DetailSection title="메인 전광판의 주인공">
              <article className="fd-card fd-card--winner">
                <Avatar item={winner} size="lg" />
                <span className="fd-badge fd-badge--winner">1위 · 메인 전광판</span>
                <h3 className="fd-name">{winner.name}</h3>
                <p className="fd-sub">{cheerSub(winner)}</p>
                <p className="fd-like-count">축하 {winner.likeCount.toLocaleString('ko-KR')}개</p>
                <p className="fd-wish">{congratsLine(winner, board.birthdayOnly)}</p>
                <CheerQuote item={winner} />
                <Actions item={winner} busy={busy} onLike={like} onGoods={goods} />
              </article>
            </DetailSection>
          ) : null}

          {onlyOne ? (
            <DetailSection>
              <p className="fd-empty">오늘 {word}인 최애는 {winner.name}뿐이에요.</p>
            </DetailSection>
          ) : null}

          {rivals.length || others.length ? (
            <DetailSection
              title={rivals.length ? `함께 ${word}을 맞은 최애들` : `오늘 ${word}인 최애`}
              description={rivals.length ? `같은 날 ${word}이라 함께 응원 경쟁을 했던 최애들이에요. 이 최애들도 ${word} 축하해요!` : undefined}
            >
              <div className="fd-list">
                {rivals.map((item) => (
                  <article className="fd-card" key={item.characterId}>
                    <div className="fd-card__top">
                      <Avatar item={item} />
                      <div className="fd-card__info">
                        <span className="fd-badge">응원 {item.rank}위</span>
                        <h3 className="fd-name">{item.name}</h3>
                        <p className="fd-sub">{cheerSub(item)}</p>
                        <p className="fd-like-count">축하 {item.likeCount.toLocaleString('ko-KR')}개</p>
                      </div>
                    </div>
                    <p className="fd-wish">{congratsLine(item, board.birthdayOnly)}</p>
                    <CheerQuote item={item} />
                    <Actions item={item} busy={busy} onLike={like} onGoods={goods} />
                  </article>
                ))}
                {others.map((item) => (
                  <article className="fd-mini" key={item.characterId}>
                    <Avatar item={item} size="sm" />
                    <div className="fd-mini__info">
                      <strong>{congratsLine(item, board.birthdayOnly)}</strong>
                      {item.workTitle ? <span>{item.workTitle}</span> : null}
                      <span className="fd-mini__likes">축하 {item.likeCount.toLocaleString('ko-KR')}개</span>
                    </div>
                    <button type="button" className={`fd-btn fd-btn--like fd-btn--small${item.liked ? ' is-on' : ''}`} disabled={busy} aria-pressed={item.liked} onClick={() => like(item)}>
                      <HeartIcon on={item.liked} /> 축하하기
                    </button>
                  </article>
                ))}
              </div>
              <p className="bd__caption">응원에 참여하지 않았어도 오늘 {word}인 최애는 모두 여기에 보여요.</p>
            </DetailSection>
          ) : null}

          {everyone.length ? (
            <DetailSection title={`${word} 축하 한마디 남기기`}>
              <div className="fd-chips" role="radiogroup" aria-label="축하할 최애">
                {everyone.map((item) => (
                  <button
                    key={item.characterId}
                    type="button"
                    role="radio"
                    aria-checked={item.characterId === selectedId}
                    className={item.characterId === selectedId ? 'is-on' : ''}
                    onClick={() => setPicked(item.characterId)}
                  >{item.name}</button>
                ))}
              </div>
              <div className="fd-form">
                <input
                  type="text"
                  value={text}
                  maxLength={CONGRATS_MAX}
                  placeholder={selected ? `${selected.name}에게 ${word} 축하 한마디` : '축하 한마디'}
                  aria-label="축하 한마디"
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') submit(); }}
                />
                <button type="button" className="fd-btn fd-btn--primary" disabled={posting || !text.trim() || !selected} onClick={submit}>
                  등록
                </button>
              </div>
              <p className="bd__caption">
                {text.length} / {CONGRATS_MAX} · 무료로 남길 수 있어요. 비방·광고성 글은 숨김 처리돼요.
                {loggedIn ? '' : ' (로그인이 필요해요)'}
              </p>
              {congratsNotice ? <p className="fd-notice" role="status">{congratsNotice}</p> : null}
              {congratsError ? <p className="fan-error" role="alert">{congratsError}</p> : null}

              {board.congrats.length ? (
                <ul className="fd-congrats">
                  {board.congrats.map((entry) => (
                    <li key={entry.id}>
                      <span className="fd-congrats__to">{entry.characterName}</span>
                      {editingId === entry.id ? (
                        <>
                          <div className="fd-congrats__edit">
                            <input
                              type="text"
                              value={editText}
                              maxLength={CONGRATS_MAX}
                              aria-label="축하 한마디 수정"
                              autoFocus
                              onChange={(event) => setEditText(event.target.value)}
                              onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(); }}
                            />
                            <button type="button" disabled={posting || !editText.trim()} onClick={saveEdit}>저장</button>
                            <button type="button" disabled={posting} onClick={() => setEditingId(null)}>취소</button>
                          </div>
                          <small>{editText.length} / {CONGRATS_MAX}</small>
                        </>
                      ) : (
                        <p>{entry.message}</p>
                      )}
                      <div className="fd-congrats__meta">
                        <small>
                          {entry.nickname}{entry.mine ? ' · 내 글' : ''}
                          {entry.createdAt ? <> · <time dateTime={entry.createdAt}>{congratsTime(entry.createdAt)}</time></> : null}
                        </small>
                        {entry.mine && editingId !== entry.id ? (
                          <span className="fd-congrats__actions">
                            <button type="button" disabled={posting} onClick={() => startEdit(entry)}>수정</button>
                            <button type="button" disabled={posting} onClick={() => remove(entry)}>삭제</button>
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </DetailSection>
          ) : null}
        </>
      ) : null}
    </DetailShell>
  );
}
