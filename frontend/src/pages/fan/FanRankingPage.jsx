import { useEffect, useState } from 'react';
import { DetailSection, DetailShell } from '../home/BannerDetailParts.jsx';
import { MOCK_RANKING } from './fanGuideData.js';
import './FanCheer.css';

const SLOTS = [
  ['ANNIV', '기념일'],
  ['FREE', '자유'],
];

const formatDay = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getMonth() + 1}.${date.getDate()}`;
};

function countdown(endAt, now) {
  const left = new Date(endAt).getTime() - now;
  if (left <= 0) return '마감됐어요';
  const hours = Math.floor(left / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const days = Math.floor(hours / 24);
  return `${days > 0 ? `${days}일 ` : ''}${String(hours % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const EXAMPLE_ITEMS = MOCK_RANKING.map((item, index) => ({
  characterId: `example-${item.rank}`,
  rank: item.rank,
  name: item.name,
  cheerCount: item.count,
  paidAmount: [24000, 15000, 9000][index] ?? 0,
  myCount: 0,
}));

// 실시간 응원 순위 (/fan/ranking). 순위는 짧은 주기로 갱신된다.
export default function FanRankingPage({
  ranking,
  dates,
  slot,
  date,
  loading,
  error,
  onBack,
  onChangeSlot,
  onChangeDate,
  onCheer,
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // 아직 응원이 없으면 예시 순위를 보여 준다 (실제 응원이 생기면 바로 실제 순위로 바뀐다)
  const isExample = Boolean(ranking) && !(ranking.items?.length > 0);
  const items = isExample ? EXAMPLE_ITEMS : ranking?.items ?? [];
  const top = items[0]?.cheerCount ?? 0;
  const minPaid = ranking?.minPaidAmount || (isExample ? 30000 : 0);
  const leaderPaid = items[0]?.paidAmount ?? 0;
  const progress = minPaid ? Math.min(100, Math.round((leaderPaid / minPaid) * 100)) : 0;
  const freeSlots = ranking?.freeSlotCount || (isExample ? 2 : 0);

  return (
    <DetailShell
      title="실시간 응원 순위"
      ready={Boolean(ranking) || Boolean(error)}
      error={error && !ranking ? error : undefined}
      onBack={onBack}
      footer={<button className="bd__btn" type="button" onClick={onCheer}>더 응원하기</button>}
    >
      <DetailSection>
        <div className="fan-tabs" role="tablist" aria-label="응원 자리">
          {SLOTS.map(([type, label]) => (
            <button key={type} type="button" role="tab" aria-selected={slot === type} className={slot === type ? 'is-on' : ''} onClick={() => onChangeSlot(type)}>{label}</button>
          ))}
        </div>
        {slot === 'ANNIV' ? (
          dates.length ? (
            <div className="fan-chips">
              {dates.map((item) => (
                <button key={item.date} type="button" aria-pressed={date === item.date} className={date === item.date ? 'is-on' : ''} onClick={() => onChangeDate(item.date)}>
                  {formatDay(item.date)} {item.items.map((i) => i.name).join('·')}
                </button>
              ))}
            </div>
          ) : (
            <p className="bd__empty">다음 주에 기념일이 있는 최애가 없어요</p>
          )
        ) : null}
        {ranking ? (
          <p className="fan-count" aria-live="off">
            {ranking.open ? <>마감까지 <b>{countdown(ranking.applyEndAt, now)}</b></> : <b>이번 주 응원이 마감됐어요</b>}
            {loading ? <span> · 갱신 중</span> : null}
          </p>
        ) : null}
      </DetailSection>

      <DetailSection
        title={slot === 'FREE' ? `자유 응원 순위 (상위 ${freeSlots}위 게시 확정권)` : '응원 순위'}
        description={isExample ? '아직 응원이 없어서 예시 순위를 보여드려요' : undefined}
      >
        {items.length === 0 ? (
          <p className="bd__empty">아직 응원이 없어요. 첫 번째로 응원해 보세요!</p>
        ) : (
          <ol className="bd__rank">
            {items.map((item) => (
              <li key={item.characterId}>
                <span className="bd__rank-no">{item.rank}</span>
                <div className="bd__rank-body">
                  <strong>
                    {item.name}
                    {slot === 'FREE' && item.rank <= freeSlots ? <em className="fan-badge">확정권</em> : null}
                  </strong>
                  <i style={{ width: `${top ? Math.round((item.cheerCount / top) * 100) : 0}%` }} />
                  {item.myCount > 0 ? <small>내 응원 {item.myCount}회</small> : null}
                </div>
                <b>{item.cheerCount.toLocaleString('ko-KR')}회</b>
              </li>
            ))}
          </ol>
        )}
      </DetailSection>

      {items.length > 0 ? (
        <DetailSection title="게시 최소 성립 금액" description="1위 최애의 유료 응원 합계가 이 금액을 넘어야 배너가 게시돼요">
          <div className="fan-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <p className="bd__caption">
            1위 유료 응원 {leaderPaid.toLocaleString('ko-KR')}P / {minPaid.toLocaleString('ko-KR')}P
            {leaderPaid >= minPaid ? ' · 성립했어요' : ''}
          </p>
        </DetailSection>
      ) : null}
    </DetailShell>
  );
}
