import { useEffect, useState } from 'react';
import { STAGE_ACTIONS, STAGE_CHARACTERS, STAGE_SERIES } from './stageMockData.js';
import './StageSection.css';

const ROW_HEIGHT = 56;
const TICK_MS = 1600;

function StageCharacter({ character, className }) {
  return character.cutoutUrl
    ? <img className={className} src={character.cutoutUrl} alt={character.name} draggable={false} />
    : <span className={className}><CharacterFace character={character} size={72} /></span>;
}

function initialCharacters() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('stage-demo-points') || '{}');
    return STAGE_CHARACTERS.map((character) => ({ ...character, points: Number.isFinite(saved[character.id]) ? saved[character.id] : character.points }));
  } catch {
    return STAGE_CHARACTERS.map((character) => ({ ...character }));
  }
}

function pickAction() {
  const total = STAGE_ACTIONS.reduce((sum, action) => sum + action.weight, 0);
  let roll = Math.random() * total;
  return STAGE_ACTIONS.find((action) => (roll -= action.weight) < 0) ?? STAGE_ACTIONS[0];
}

// 이번 주 목요일 23:59:59 (한국 시간) 마감
function nextDeadline(now) {
  const kst = new Date(now + 9 * 3600 * 1000);
  const daysUntilThursday = (4 - kst.getUTCDay() + 7) % 7;
  const deadline = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + daysUntilThursday, 23, 59, 59);
  return deadline - 9 * 3600 * 1000;
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const time = [Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return `${days}일 ${time}`;
}

function rankCharacters(characters) {
  return [...characters].sort((a, b) => b.points - a.points);
}

export function CharacterFace({ character, size }) {
  const series = STAGE_SERIES[character.series];
  if (character.imageUrl) {
    return <img className="stage-face" src={character.imageUrl} alt="" style={{ width: size, height: size }} draggable={false} />;
  }
  return (
    <span className="stage-face stage-face--initial" style={{ width: size, height: size, background: series.color, fontSize: Math.round(size * 0.4) }}>
      {character.name.slice(0, 1)}
    </span>
  );
}

// onCheer(characterId): 응원하기(랜덤박스·최애박스) 화면으로 이동, onOpenGuide: 최애 스테이지 안내 화면으로 이동
export default function StageSection({ onCheer, onOpenGuide, onRankingChange, compact = false }) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [previousRanks, setPreviousRanks] = useState({});
  const [feed, setFeed] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [rankingOpen, setRankingOpen] = useState(false); // 섹션이 길어서 2~10위는 기본으로 접어 둔다

  useEffect(() => {
    const timer = setInterval(() => {
      const target = STAGE_CHARACTERS[Math.floor(Math.random() * STAGE_CHARACTERS.length)];
      const action = pickAction();
      setCharacters((current) => {
        setPreviousRanks(Object.fromEntries(rankCharacters(current).map((character, index) => [character.id, index])));
        return current.map((character) => (
          character.id === target.id ? { ...character, points: character.points + action.points } : character
        ));
      });
      setFeed({ key: Date.now(), id: target.id, text: `${action.label} → ${target.name} +${action.points.toLocaleString()}P` });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('stage-demo-points', JSON.stringify(Object.fromEntries(characters.map((character) => [character.id, character.points]))));
    } catch { /* 저장소를 사용할 수 없어도 시연은 계속한다. */ }
  }, [characters]);

  useEffect(() => {
    onRankingChange?.(rankCharacters(characters));
  }, [characters, onRankingChange]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ranked = rankCharacters(characters);
  const [leader, ...others] = ranked;

  return (
    <section className={`home-section stage-section${compact ? ' stage-section--compact' : ''}`} aria-label="LIVE 최애 스테이지">
      <div className="home-section-heading">
        <div>
          <h2><span className="stage-live">LIVE</span> 최애 스테이지</h2>
          <p>이번 주 무대의 주인공은? · 정산까지 {formatRemaining(nextDeadline(now) - now)}</p>
        </div>
        {onOpenGuide && !compact ? (
          <button type="button" onClick={onOpenGuide}>자세히 <span aria-hidden="true">›</span></button>
        ) : null}
      </div>

      {/* 홈에서 굿즈가 첫 화면에 같이 보이도록 1위 무대는 가로형으로 낮게 둔다 */}
      <div className="stage">
        <div className="stage__podium">
          {compact ? (
            <div className="stage__backing" aria-label={`백댄서: 2위 ${others[0].name}, 3위 ${others[1].name}`}>
              <StageCharacter className="stage__dancer stage__dancer--left" character={others[0]} />
              <StageCharacter className="stage__dancer stage__dancer--right" character={others[1]} />
            </div>
          ) : null}
          <div className="stage__hero" key={leader.id}>
            <div className="stage__figure">
              {compact ? (
                <StageCharacter className="stage__cutout" character={leader} />
              ) : <CharacterFace character={leader} size={72} />}
            </div>
          </div>
          <div className="stage__floor" aria-hidden="true" />
        </div>
        <div className={compact ? 'stage__sidebar' : 'stage__details'}>
        <div className="stage__info">
          <p className="stage__series">{compact ? '' : '1위 · '}{STAGE_SERIES[leader.series].name}</p>
          <p className="stage__name">{compact ? '1위 ' : ''}{leader.name}</p>
          <p className="stage__points">{leader.points.toLocaleString()}P</p>
          {!compact && onCheer ? (
            <button className="stage__cheer" type="button" onClick={() => onCheer(leader.id)}>
              응원하기 <span aria-hidden="true">›</span>
            </button>
          ) : null}
        </div>
        {compact ? (
          <div className="stage__rankings">
          <p className="stage-demo-label">시연 순위 · 점수 갱신 중</p>
          <ol className="stage-banner-ranking" start={2} aria-label="최애 스테이지 2~10위">
            {characters.filter((character) => character.id !== leader.id).map((character) => {
              const index = others.findIndex((item) => item.id === character.id);
              const moved = character.id in previousRanks ? previousRanks[character.id] - index - 1 : 0;
              return (
              <li key={character.id} style={{ top: index * 15 }} className={feed?.id === character.id ? 'is-updated' : ''}>
                <span className="stage-banner-ranking__rank">{index + 2}</span>
                <img className="stage-banner-ranking__portrait" src={character.cutoutUrl} alt="" draggable={false} />
                <span className="stage-banner-ranking__name">{character.name}</span>
                <span className="stage-banner-ranking__points">{character.points.toLocaleString()}</span>
                <span className={`stage-banner-ranking__change${moved > 0 ? ' is-up' : moved < 0 ? ' is-down' : ''}`} aria-label={moved ? `${Math.abs(moved)}계단 ${moved > 0 ? '상승' : '하락'}` : '변동 없음'}>{moved > 0 ? `↑${moved}` : moved < 0 ? `↓${-moved}` : '–'}</span>
              </li>
              );
            })}
          </ol>
          </div>
        ) : null}
        {compact && onOpenGuide ? (
          <button className="promo-banner__cta stage-banner-cta" type="button" onClick={onOpenGuide}>
            자세히 보기 <b aria-hidden="true">›</b>
          </button>
        ) : null}
        </div>
      </div>

      {!compact && <>
      <p className="stage-feed" aria-live="polite">
        {feed ? <span key={feed.key}>{feed.text}</span> : '응원이 들어오면 여기에 표시돼요'}
      </p>

      <button
        className="stage-toggle"
        type="button"
        aria-expanded={rankingOpen}
        aria-controls="stage-ranking"
        onClick={() => setRankingOpen((open) => !open)}
      >
        {rankingOpen ? '순위 접기' : `2~${ranked.length}위 순위 보기`}
        <span className={`stage-toggle__arrow${rankingOpen ? ' open' : ''}`} aria-hidden="true">⌄</span>
      </button>

      <ol
        id="stage-ranking"
        className="stage-ranking"
        style={{ height: rankingOpen ? others.length * ROW_HEIGHT : 0 }}
        aria-hidden={!rankingOpen}
      >
        {characters.map((character) => {
          const rank = ranked.findIndex((item) => item.id === character.id);
          if (rank === 0) return null;
          const moved = character.id in previousRanks ? previousRanks[character.id] - rank : 0;
          return (
            <li
              key={character.id}
              className={`stage-row${feed?.id === character.id ? ' stage-row--bump' : ''}`}
              style={{ top: (rank - 1) * ROW_HEIGHT }}
            >
              <span className="stage-row__rank">{rank + 1}</span>
              <CharacterFace character={character} size={38} />
              <span className="stage-row__info">
                <b>{character.name}</b>
                <small>{STAGE_SERIES[character.series].name}</small>
              </span>
              <span className="stage-row__points">{character.points.toLocaleString()}P</span>
              {onCheer ? (
                <button
                  className="stage-row__cheer"
                  type="button"
                  aria-label={`${character.name} 응원하기`}
                  tabIndex={rankingOpen ? 0 : -1}
                  onClick={() => onCheer(character.id)}
                >응원</button>
              ) : null}
              <span className={`stage-row__move${moved > 0 ? ' up' : moved < 0 ? ' down' : ''}`}>
                {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '-'}
              </span>
            </li>
          );
        })}
      </ol>
      </>}
    </section>
  );
}
