import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import FanBoard from '../fan/FanBoard.jsx';
import { defaultDesign } from '../fan/fanBoardPresets.js';
import {
  CHEER_STEPS,
  FREE_TICKET_RULES,
  GUIDE_NOTICES,
  MOCK_RANKING,
  RETURN_RULES,
  SCHEDULE,
  currentScheduleIndex,
  thisWeekDeadline,
} from '../fan/fanGuideData.js';

const SLOTS = [
  {
    type: 'ANNIV',
    title: '기념일 전광판',
    desc: '다음 주에 기념일이 있는 최애끼리 겨뤄요. 기념일 날짜별로 응원 수 1위 최애가 그날 당일 게시돼요.',
    design: { ...defaultDesign('ANNIV'), dateLine: '2026. 12. 07 · BIRTHDAY', message: 'HAPPY BIRTHDAY', name: '내 최애', nickname: '닉네임' },
  },
  {
    type: 'FREE',
    title: '자유 응원 전광판',
    desc: '특별한 날이 아니어도 괜찮아요. 이번 주 자유 응원 순위 상위 최애가 기념일 없는 날짜에 하루씩 게시돼요.',
    design: { ...defaultDesign('FREE'), name: '내 최애', nickname: '닉네임' },
  },
];

// 응원 홍보 배너의 "자세히 보기" 화면 (/fan/guide)
export default function FanGuidePage({ status, ranking, onBack, onCheer, onShowRanking, onShowResult, onShowTickets }) {
  const deadline = thisWeekDeadline();
  const stage = currentScheduleIndex();
  const rows = ranking?.length ? ranking : MOCK_RANKING;
  const isExample = !ranking?.length;
  const topCount = rows[0].count;

  return (
    <DetailShell
      title="응원 안내"
      ready
      onBack={onBack}
      hero={(
        <section className="bd__hero bd__hero--fan">
          <p className="bd__eyebrow">이번 주 메인은 내 최애</p>
          <h2>{'내 최애를\n메인 배너에 올려요'}</h2>
          <p className="bd__hero-desc">
            <span className="bd__pill">마감 {deadline.label} · 목 23:59</span>
          </p>
        </section>
      )}
      footer={<button className="bd__btn" type="button" onClick={onCheer}>내 최애 응원하기</button>}
    >
      <DetailSection title="두 가지 응원 자리">
        <ul className="bd__slots">
          {SLOTS.map((slot) => (
            <li key={slot.type}>
              <div className="bd__slot-preview"><FanBoard design={slot.design} /></div>
              <strong>{slot.title}</strong>
              <p>{slot.desc}</p>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="이렇게 응원해요">
        <ol className="bd__steps">
          {CHEER_STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="bd__step-no">{index + 1}</span>
              <div><strong>{step.title}</strong><p>{step.desc}</p></div>
            </li>
          ))}
        </ol>
      </DetailSection>

      <DetailSection title="무료 응원권 받는 방법" description="무료 응원권 1장 = 응원 1회 (포인트 대신 사용)">
        <table className="bd__table">
          <thead><tr><th>방법</th><th>지급</th><th>한도</th></tr></thead>
          <tbody>
            {FREE_TICKET_RULES.map((rule) => (
              <tr key={rule.reason}><td>{rule.reason}</td><td>{rule.amount}</td><td>{rule.limit}</td></tr>
            ))}
          </tbody>
        </table>
      </DetailSection>

      <DetailSection title="진행 일정">
        <ol className="bd__timeline">
          {SCHEDULE.map((step, index) => (
            <li key={step.key} className={index === stage ? 'is-current' : ''} aria-current={index === stage ? 'step' : undefined}>
              <span className="bd__timeline-day">{step.day}</span>
              <div>
                <strong>{step.title}{index === stage ? <em>진행 중</em> : null}</strong>
                <p>{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </DetailSection>

      <DetailSection title="실시간 응원 순위" description={isExample ? '아직 응원이 없어서 예시 순위를 보여드려요' : '이번 주 자유 응원 순위예요'}>
        <ol className="bd__rank">
          {rows.map((item) => (
            <li key={item.rank}>
              <span className="bd__rank-no">{item.rank}</span>
              <div className="bd__rank-body">
                <strong>{item.name}</strong>
                <i style={{ width: `${Math.round((item.count / topCount) * 100)}%` }} />
              </div>
              <b>{item.count.toLocaleString('ko-KR')}회</b>
            </li>
          ))}
        </ol>
        <button className="bd__link-btn" type="button" onClick={onShowRanking}>실시간 순위 전체 보기 ›</button>
        <button className="bd__link-btn" type="button" onClick={onShowResult}>지난 주 내 응원 결과 보기 ›</button>
        <button className="bd__link-btn" type="button" onClick={onShowTickets}>응원권 구매하기 ›</button>
        <p className="bd__caption">
          이번 주 전체 응원 {status.totalCheers.toLocaleString('ko-KR')}회
          {status.freeTickets === null ? '' : ` · 내 무료 응원권 ${status.freeTickets}장`}
        </p>
      </DetailSection>

      <DetailSection title="떨어졌을 때는 반환돼요" description="진 최애에 쓴 유료 응원은 적립금으로 바로 돌려드려요">
        <ul className="bd__returns">
          {RETURN_RULES.map((rule) => (
            <li key={rule.title}><strong>{rule.title}</strong><p>{rule.desc}</p></li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="유의사항">
        <NoticeList items={GUIDE_NOTICES} />
      </DetailSection>
    </DetailShell>
  );
}
