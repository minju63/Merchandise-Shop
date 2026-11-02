import { STAGE_SERIES } from './stageMockData.js';
import { CharacterFace, MoveBadge } from './StageSection.jsx';
import { formatRemaining, nextDeadline, rankMove, useLiveStage, useNow } from './stageLive.js';

// 무대 위 1위: 누끼 이미지는 틀 없이 크게, 굿즈 사진은 액자로, 둘 다 없으면 이름 배지
function StageFigure({ character }) {
  if (character.cutoutUrl) {
    return <img className="stage-banner__cutout" src={character.cutoutUrl} alt="" draggable={false} />;
  }
  if (character.imageUrl) {
    return <img className="stage-banner__figure" src={character.imageUrl} alt="" draggable={false} />;
  }
  return <CharacterFace character={character} size={88} />;
}

// 홈 배너용 LIVE 최애 스테이지: 왼쪽은 조명 아래 1위 무대, 오른쪽은 1위 이름과 2·3위 실시간 변동.
// 배너를 누르면 스테이지 화면(1~10위)으로 간다.
export default function StageBanner() {
  const { ranked } = useLiveStage();
  const now = useNow();
  const leader = ranked[0];

  return (
    <div className="stage-banner">
      <div className="stage-banner__left">
        <p className="stage-banner__title">
          <span className="stage-live">LIVE</span> 최애 스테이지
        </p>
        <p className="stage-banner__sub">정산까지 {formatRemaining(nextDeadline(now) - now)}</p>
        <div className="stage-banner__stage" aria-hidden="true">
          <span className="stage-banner__light" />
          <span className="stage-banner__hero" key={leader.id}>
            <StageFigure character={leader} />
          </span>
          <span className="stage-banner__floor" />
        </div>
      </div>

      <div className="stage-banner__right">
        <div className="stage-banner__list-head">
          <p className="stage-banner__label">실시간 순위 · 점수 갱신 중</p>
        </div>
        <ol className="stage-banner__ranks">
          {ranked.slice(0, 5).map((character, rank) => (
            <li key={character.id} className={rank === 0 ? 'is-first' : ''}>
              <span className="stage-banner__rank">{rank + 1}</span>
              <CharacterFace character={character} size={24} />
              <span className="stage-banner__who">
                <b>{character.name}</b>
                {rank === 0 ? <small>{STAGE_SERIES[character.series].name}</small> : null}
              </span>
              <span className="stage-banner__score">{character.points.toLocaleString()}</span>
              <MoveBadge moved={rankMove(character.id, rank)} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
