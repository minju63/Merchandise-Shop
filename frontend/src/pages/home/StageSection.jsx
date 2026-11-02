import { useEffect, useState } from 'react';
import { STAGE_ACTIONS, STAGE_CHARACTERS, STAGE_SERIES } from './stageMockData.js';
import './StageSection.css';

const ROW_HEIGHT = 56;
const TICK_MS = 1600;

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
export default function StageSection({ onCheer, onOpenGuide }) {
  const [characters, setCharacters] = useState(() => STAGE_CHARACTERS.map((character) => ({ ...character })));
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
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const ranked = rankCharacters(characters);
  const [leader, ...others] = ranked;

  return (
    <section className="home-section stage-section" aria-label="LIVE 최애 스테이지">
      <div className="home-section-heading">
        <div>
          <h2><span className="stage-live">LIVE</span> 최애 스테이지</h2>
          <p>이번 주 무대의 주인공은? · 정산까지 {formatRemaining(nextDeadline(now) - now)}</p>
        </div>
        {onOpenGuide ? (
          <button type="button" onClick={onOpenGuide}>자세히 <span aria-hidden="true">›</span></button>
        ) : null}
      </div>

      {/* 홈에서 굿즈가 첫 화면에 같이 보이도록 1위 무대는 가로형으로 낮게 둔다 */}
      <div className="stage">
        <div className="stage__podium">
          <div className="stage__hero" key={leader.id}>
            <span className="stage__crown" aria-hidden="true">👑</span>
            <div className="stage__figure"><CharacterFace character={leader} size={72} /></div>
          </div>
          <div className="stage__floor" aria-hidden="true" />
        </div>
        <div className="stage__info">
          <p className="stage__series">1위 · {STAGE_SERIES[leader.series].name}</p>
          <p className="stage__name">{leader.name}</p>
          <p className="stage__points">{leader.points.toLocaleString()}P</p>
          {onCheer ? (
            <button className="stage__cheer" type="button" onClick={() => onCheer(leader.id)}>
              응원하기 <span aria-hidden="true">›</span>
            </button>
          ) : null}
        </div>
      </div>

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
    </section>
  );
}
