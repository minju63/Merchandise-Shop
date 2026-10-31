import { useState } from 'react';
import { DetailSection, DetailShell } from '../home/BannerDetailParts.jsx';
import { ANNIVERSARY_KINDS } from './fanBoardPresets.js';
import { splitTickets } from './fanGuideData.js';
import './FanCheer.css';

const SLOTS = [
  { type: 'ANNIV', title: '기념일 응원', desc: '기념일 날짜별 1위 최애가 당일 게시' },
  { type: 'FREE', title: '자유 응원', desc: '순위 상위 최애가 하루씩 게시' },
];

const QUICK_COUNTS = [1, 10, 50, 100];

// 응원 진행도 목록: [지급 사유, 이름, 한도]
const EARN_WAYS = [
  ['BASE', '매주 기본', 1],
  ['PICKUP', '매장 픽업 완료', 5],
  ['REVIEW', '구매한 굿즈 리뷰', 2],
  ['GOODS_PASS', '굿즈 패스 회원', 1],
];

const formatDay = (value) => {
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

// 응원하기 화면 (/fan/cheer)
export default function FanCheerPage({
  me,
  characters,
  charactersLoading,
  slot,
  query,
  sending,
  error,
  onBack,
  onChangeSlot,
  onChangeQuery,
  onSubmit,
  onCharge,
  onRequestAnniversary,
}) {
  const [character, setCharacter] = useState(null);
  const [kind, setKind] = useState('');
  const [message, setMessage] = useState('');
  const [nickname, setNickname] = useState('');
  const [count, setCount] = useState(1);
  const [agreedRules, setAgreedRules] = useState(false);
  const [agreedImageRights, setAgreedImageRights] = useState(false);

  const price = me?.cheerPrice ?? 1000;
  const remaining = me?.todayRemaining ?? 0;
  const safeCount = Math.min(Math.max(count, 1), Math.max(remaining, 1));
  const cost = splitTickets(safeCount, {
    free: me?.freeTickets ?? 0,
    credit: me?.creditTickets ?? 0,
    cash: me?.cashTickets ?? 0,
  });
  const lackTickets = cost.short > 0;
  const anniversary = slot === 'ANNIV' ? character?.anniversaries.find((item) => item.kind === kind) : null;
  const ready = Boolean(me?.open)
    && remaining >= 1
    && Boolean(character)
    && (slot === 'FREE' || Boolean(anniversary))
    && message.trim().length > 0
    && nickname.trim().length > 0
    && !lackTickets
    && agreedRules
    && agreedImageRights;

  const chooseSlot = (next) => {
    onChangeSlot(next);
    setCharacter(null);
    setKind('');
  };

  const chooseCharacter = (next) => {
    setCharacter(next);
    setKind(slot === 'ANNIV' && next.anniversaries.length === 1 ? next.anniversaries[0].kind : '');
  };

  const submit = () => onSubmit({
    slotType: slot,
    characterId: character.id,
    anniversaryId: anniversary?.id,
    message: message.trim(),
    nickname: nickname.trim(),
    count: safeCount,
    agreedRules,
    agreedImageRights,
  }, anniversary?.eventDate);

  return (
    <DetailShell
      title="내 최애 응원하기"
      ready={Boolean(me)}
      error={error && !me ? error : undefined}
      onBack={onBack}
      footer={(
        <button className="bd__btn" type="button" disabled={!ready || sending} onClick={submit}>
          {sending ? '응원을 보내는 중...' : `응원 ${safeCount}회 보내기${cost.cash ? ` (${(cost.cash * price).toLocaleString('ko-KR')}원 상당)` : ''}`}
        </button>
      )}
    >
      {me && !me.open ? (
        <p className="fan-closed">이번 주 응원은 마감됐어요. 다음 주 월요일부터 다시 응원할 수 있어요.</p>
      ) : null}

      <DetailSection title="① 응원 유형">
        <div className="fan-pick" role="radiogroup" aria-label="응원 유형">
          {SLOTS.map((item) => (
            <button
              key={item.type}
              type="button"
              role="radio"
              aria-checked={slot === item.type}
              className={slot === item.type ? 'is-on' : ''}
              onClick={() => chooseSlot(item.type)}
            >
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </button>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="② 최애 선택"
        description={slot === 'ANNIV' ? '다음 주에 기념일이 있는 최애만 고를 수 있어요' : '좋아하는 캐릭터를 검색해 보세요'}
      >
        <input
          className="fan-input"
          type="search"
          value={query}
          placeholder="캐릭터·작품 이름 검색"
          aria-label="최애 검색"
          onChange={(event) => onChangeQuery(event.target.value)}
        />
        {charactersLoading ? <p className="bd__empty">불러오는 중...</p> : null}
        {!charactersLoading && characters.length === 0 ? (
          <p className="bd__empty">{slot === 'ANNIV' ? '다음 주에 기념일이 있는 최애가 없어요' : '검색 결과가 없어요'}</p>
        ) : null}
        <ul className="fan-list">
          {characters.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={character?.id === item.id}
                className={character?.id === item.id ? 'is-on' : ''}
                onClick={() => chooseCharacter(item)}
              >
                <strong>{item.name}</strong>
                <span>
                  {item.workTitle}
                  {item.anniversaries.length ? ` · ${item.anniversaries.map((a) => formatDay(a.eventDate)).join(', ')}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <button className="fan-link" type="button" onClick={onRequestAnniversary}>
          찾는 최애·기념일이 없나요? 기념일 등록 요청 ›
        </button>
      </DetailSection>

      {slot === 'ANNIV' ? (
        <DetailSection title="③ 기념일 종류">
          <div className="fan-chips">
            {Object.entries(ANNIVERSARY_KINDS).map(([key, value]) => (
              <button
                key={key}
                type="button"
                aria-pressed={kind === key}
                disabled={!character?.anniversaries.some((item) => item.kind === key)}
                className={kind === key ? 'is-on' : ''}
                onClick={() => setKind(key)}
              >{value.label}</button>
            ))}
          </div>
          {!character ? <p className="bd__caption">최애를 먼저 골라 주세요.</p> : null}
        </DetailSection>
      ) : null}

      <DetailSection title="④ 응원 한마디">
        <label className="fan-field">
          <span>응원 한마디 <em>{message.length}/30</em></span>
          <input className="fan-input" type="text" maxLength={30} value={message} placeholder="최애에게 전하고 싶은 말" onChange={(event) => setMessage(event.target.value)} />
        </label>
        <label className="fan-field">
          <span>표시 닉네임 <em>{nickname.length}/20</em></span>
          <input className="fan-input" type="text" maxLength={20} value={nickname} placeholder="전광판에 from. 으로 표시돼요" onChange={(event) => setNickname(event.target.value)} />
        </label>
      </DetailSection>

      <DetailSection title="⑤ 응원 횟수" description={`오늘 남은 응원 ${remaining}/${me?.dailyLimit ?? 100}회`}>
        <div className="fan-stepper">
          <button type="button" aria-label="횟수 줄이기" disabled={safeCount <= 1} onClick={() => setCount(safeCount - 1)}>−</button>
          <strong>{remaining === 0 ? 0 : safeCount}회</strong>
          <button type="button" aria-label="횟수 늘리기" disabled={safeCount >= remaining} onClick={() => setCount(safeCount + 1)}>＋</button>
        </div>
        <div className="fan-chips fan-chips--center">
          {QUICK_COUNTS.map((value) => (
            <button key={value} type="button" disabled={value > remaining} onClick={() => setCount(value)}>{value}회</button>
          ))}
        </div>
        <p className="fan-cost">
          무료 {cost.free}장 · 적립금 구매 {cost.credit}장 · 현금 구매 {cost.cash}장 사용
          <br />
          <span>보유 무료 {me?.freeTickets ?? 0}장 · 적립금 구매 {me?.creditTickets ?? 0}장 · 현금 구매 {me?.cashTickets ?? 0}장</span>
        </p>
        {lackTickets ? (
          <p className="fan-error" role="alert">
            응원권이 {cost.short}장 부족해요.{' '}
            <button className="fan-link" type="button" onClick={onCharge}>응원권 구매하러 가기 ›</button>
          </p>
        ) : null}
      </DetailSection>

      <DetailSection title="⑥ 무료 응원권 더 받기">
        <ul className="fan-earn">
          {EARN_WAYS.map(([reason, name, limit]) => (
            <li key={reason}>
              <span>{name}</span>
              <b>{Math.min(me?.freeProgress?.[reason] ?? 0, limit)}/{limit}</b>
            </li>
          ))}
        </ul>
        <p className="bd__caption">무료 응원권은 목요일 마감 후 소멸하고, 무료로 한 응원은 반환되지 않아요.</p>
      </DetailSection>

      <DetailSection title="⑦ 동의">
        <label className="fan-check">
          <input type="checkbox" checked={agreedRules} onChange={(event) => setAgreedRules(event.target.checked)} />
          <span>(필수) 응원·반환 규정을 확인했어요. 이긴 최애의 유료 응원은 반환되지 않아요.</span>
        </label>
        <label className="fan-check">
          <input type="checkbox" checked={agreedImageRights} onChange={(event) => setAgreedImageRights(event.target.checked)} />
          <span>(필수) 1위가 되어 전광판을 꾸미게 되면 사용 권한이 있는 이미지만 쓸게요.</span>
        </label>
        {error && me ? <p className="fan-error" role="alert">{error}</p> : null}
      </DetailSection>
    </DetailShell>
  );
}
