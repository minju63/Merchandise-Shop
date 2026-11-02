import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import { CharacterFace } from './StageSection.jsx';
import { BOXES } from './boxMockData.js';
import { STAGE_CHARACTERS, STAGE_SERIES } from './stageMockData.js';
import './StageCheer.css';

const POINT_RULES = [
  { way: '무료 응원', points: 100, limit: '하루 1회' },
  ...BOXES.map((box) => ({ way: box.title, points: box.points, limit: `${box.price.toLocaleString()}원` })),
];

const DRAW_STEPS = [
  { title: '목요일 23:59 정산', desc: '이번 주 응원 포인트가 가장 많은 최애가 1위로 확정돼요.' },
  { title: '1위 최애 응원 팬 전원 추첨 대상', desc: '1위 최애에게 포인트를 보탠 팬이라면 모두 대상이에요. 무료 응원도 포함돼요.' },
  { title: '기여 비율만큼 당첨 확률', desc: '1위 최애가 받은 전체 포인트 중 내가 보탠 비율이 곧 내 당첨 확률이에요.' },
  { title: '한정 상품 지급', desc: '당첨되면 그 최애의 한정 상품을 보내드려요. 한 사람은 한 경품만 받아요.' },
];

const PRIZES = [
  { rank: '1등', item: '넘버링 한정 피규어', winners: 1 },
  { rank: '2등', item: '한정판 미니 피규어', winners: 5 },
  { rank: '3등', item: '한정 아크릴 스탠드', winners: 20 },
];

const SCHEDULE = [
  { day: '금 00:00', title: '새 주차 시작', desc: '모든 최애의 응원 포인트가 0P부터 다시 시작해요.' },
  { day: '금~목', title: '응원 기간', desc: '무료 응원·박스 구매로 최애에게 포인트를 보태요.' },
  { day: '목 23:59', title: '정산 마감', desc: '1위 최애가 확정되고 다음 주 무대의 주인공이 돼요.' },
  { day: '금 오전', title: '경품 추첨·발표', desc: '알림과 마이페이지에서 당첨 여부를 확인할 수 있어요.' },
];

const NOTICES = [
  '기여 포인트는 결제가 완료된 박스와 무료 응원만 인정돼요. 박스를 청약철회하면 해당 포인트도 빠져요.',
  '추첨은 등수별로 순서대로 진행되고, 이미 당첨된 팬은 다음 추첨에서 제외돼요.',
  '한정 상품은 비매품이며, 당첨 후 14일 안에 배송지를 입력하지 않으면 당첨이 취소돼요.',
  '부정한 방법으로 포인트를 쌓은 경우 추첨 대상에서 제외될 수 있어요.',
];

// 홈 최애 스테이지의 "자세히" 화면 (/stage) — 실제 응원 데이터가 쌓이기 전 시연용
export default function StageGuidePage({ onBack, onCheer }) {
  const ranked = [...STAGE_CHARACTERS].sort((a, b) => b.points - a.points);
  const leader = ranked[0];
  const exampleMine = BOXES[0].points;
  const examplePercent = ((exampleMine / leader.points) * 100).toFixed(1);

  return (
    <DetailShell
      title="최애 스테이지"
      ready
      onBack={onBack}
      hero={(
        <div className="stage-guide__hero">
          <p><span className="stage-live">LIVE</span> 매주 목요일 23:59 정산</p>
          <h2>내 최애를<br />무대 위 1위로 올려요</h2>
          <small>1위 최애를 응원한 팬에게는 한정 상품 추첨 기회!</small>
        </div>
      )}
      footer={<button className="bd__btn" type="button" onClick={() => onCheer(leader.id)}>최애 응원하러 가기</button>}
    >
      <DetailSection title="최애 스테이지란?">
        <p className="stage-guide__text">
          팬들이 응원 포인트를 모아 내 최애를 무대 위에 올리는 주간 실시간 순위예요.
          매주 목요일 마감 때 1위인 최애가 다음 주 무대의 주인공이 되고,
          그 최애를 응원한 팬들에게는 기여한 만큼 한정 상품 당첨 기회가 생겨요.
        </p>
      </DetailSection>

      <DetailSection title="응원 포인트 쌓는 법" description="박스를 사면 굿즈도 받고 최애에게 포인트도 쌓여요">
        <table className="bd__table">
          <thead><tr><th>방법</th><th>응원 포인트</th><th>조건</th></tr></thead>
          <tbody>
            {POINT_RULES.map((rule) => (
              <tr key={rule.way}><td>{rule.way}</td><td>+{rule.points.toLocaleString()}P</td><td>{rule.limit}</td></tr>
            ))}
          </tbody>
        </table>
      </DetailSection>

      <DetailSection title="1위 최애 응원 팬 경품 추첨" description="기여한 포인트 비율만큼 당첨 확률이 올라가요">
        <ol className="bd__steps">
          {DRAW_STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="bd__step-no">{index + 1}</span>
              <div><strong>{step.title}</strong><p>{step.desc}</p></div>
            </li>
          ))}
        </ol>

        <div className="stage-guide__example">
          <strong>예시로 계산해 보면</strong>
          <p>
            지금 1위 {leader.name}의 포인트는 {leader.points.toLocaleString()}P예요.
            내가 랜덤박스 1개로 {exampleMine.toLocaleString()}P를 보탰다면
          </p>
          <p className="stage-guide__formula">
            {exampleMine.toLocaleString()}P ÷ {leader.points.toLocaleString()}P = <b>추첨마다 약 {examplePercent}%</b>
          </p>
        </div>

        <ul className="stage-guide__prizes">
          {PRIZES.map((prize) => (
            <li key={prize.rank}>
              <span>{prize.rank}</span>
              <b>{leader.name} {prize.item}</b>
              <small>{prize.winners}명</small>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="진행 일정">
        <ol className="bd__timeline">
          {SCHEDULE.map((step) => (
            <li key={step.day}>
              <span className="bd__timeline-day">{step.day}</span>
              <div><strong>{step.title}</strong><p>{step.desc}</p></div>
            </li>
          ))}
        </ol>
      </DetailSection>

      <DetailSection title="이번 주 순위" description="상위 5명 · 홈 최애 스테이지에서 실시간으로 바뀌어요">
        <ol className="bd__rank">
          {ranked.slice(0, 5).map((character, index) => (
            <li key={character.id}>
              <span className="bd__rank-no">{index + 1}</span>
              <CharacterFace character={character} size={32} />
              <div className="bd__rank-body">
                <strong>{character.name} <span className="stage-guide__series">{STAGE_SERIES[character.series].name}</span></strong>
                <i style={{ width: `${Math.round((character.points / leader.points) * 100)}%` }} />
              </div>
              <b>{character.points.toLocaleString()}P</b>
            </li>
          ))}
        </ol>
      </DetailSection>

      <DetailSection title="유의사항">
        <NoticeList items={NOTICES} />
      </DetailSection>
    </DetailShell>
  );
}
