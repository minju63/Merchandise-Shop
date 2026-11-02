import { useState } from 'react';
import { STAGE_SERIES } from './stageMockData.js';
import { formatRemaining, nextDeadline, rankMove, useLiveStage, useNow } from './stageLive.js';
import './StageSection.css';

const ROW_HEIGHT = 56;

export function CharacterFace({ character, size }) {
  const series = STAGE_SERIES[character.series];
  if (character.cutoutUrl) {
    return (
      <img
        className="stage-face stage-face--cutout"
        src={character.cutoutUrl}
        alt=""
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }
  if (character.imageUrl) {
    return <img className="stage-face" src={character.imageUrl} alt="" style={{ width: size, height: size }} draggable={false} />;
  }
  return (
    <span className="stage-face stage-face--initial" style={{ width: size, height: size, background: series.color, fontSize: Math.round(size * 0.4) }}>
      {character.name.slice(0, 1)}
    </span>
  );
}

export function MoveBadge({ moved }) {
  return (
    <span className={`stage-row__move${moved > 0 ? ' up' : moved < 0 ? ' down' : ''}`}>
      {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '-'}
    </span>
  );
}

// onCheer(characterId): 랜덤박스 구매(응원) 화면으로 이동, onOpenGuide: 최애 스테이지 안내 화면으로 이동
// expanded: 스테이지 화면에서는 1~10위를 접지 않고 모두 보여 준다.
export default function StageSection({ onCheer, onOpenGuide, expanded = false }) {
  const { characters, ranked, feed } = useLiveStage();
  const now = useNow();
  const [toggledOpen, setToggledOpen] = useState(false);
  const rankingOpen = expanded || toggledOpen;
  const [leader, ...others] = ranked;

  return (
    <section className={`home-section stage-section${expanded ? ' stage-section--page' : ''}`} aria-label="LIVE 최애 스테이지">
      <div className="home-section-heading">
        <div>
          <h2><span className="stage-live">LIVE</span> 최애 스테이지</h2>
          <p>이번 주 무대의 주인공은? · 정산까지 {formatRemaining(nextDeadline(now) - now)}</p>
        </div>
        {onOpenGuide ? (
          <button type="button" onClick={onOpenGuide}>자세히 <span aria-hidden="true">›</span></button>
        ) : null}
      </div>

      <div className="stage">
        <div className="stage__podium">
          <div className="stage__hero" key={leader.id}>
            <span className="stage__crown" aria-hidden="true">👑</span>
            <div className="stage__figure">
              {leader.cutoutUrl ? (
                <img className="stage__cutout" src={leader.cutoutUrl} alt="" draggable={false} />
              ) : (
                <CharacterFace character={leader} size={124} />
              )}
            </div>
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

      {expanded ? null : (
        <button
          className="stage-toggle"
          type="button"
          aria-expanded={rankingOpen}
          aria-controls="stage-ranking"
          onClick={() => setToggledOpen((open) => !open)}
        >
          {rankingOpen ? '순위 접기' : `2~${ranked.length}위 순위 보기`}
          <span className={`stage-toggle__arrow${rankingOpen ? ' open' : ''}`} aria-hidden="true">⌄</span>
        </button>
      )}

      <ol
        id="stage-ranking"
        className="stage-ranking"
        style={{ height: rankingOpen ? others.length * ROW_HEIGHT : 0 }}
        aria-hidden={!rankingOpen}
      >
        {characters.map((character) => {
          const rank = ranked.findIndex((item) => item.id === character.id);
          if (rank === 0) return null;
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
              <MoveBadge moved={rankMove(character.id, rank)} />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
