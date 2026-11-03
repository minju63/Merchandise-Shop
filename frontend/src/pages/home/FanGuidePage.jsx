import { useState } from 'react';
import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import FanBoard from '../fan/FanBoard.jsx';
import { defaultDesign } from '../fan/fanBoardPresets.js';
import './FanGuideChoice.css';

const PRICE_PER_DAY = 100000;
const won = (value) => value.toLocaleString('ko-KR');

const SLOTS = [
  {
    type: 'ANNIV',
    title: '기념일 전광판',
    desc: '생일 같은 기념일 당일에 게시돼요. 같은 날 기념일인 최애가 여러 명이면 응원 포인트를 가장 많이 받은 1위 최애가 올라가요.',
    design: { ...defaultDesign('ANNIV'), dateLine: '2026. 12. 07 · BIRTHDAY', message: 'HAPPY BIRTHDAY', name: '내 최애', nickname: '닉네임' },
  },
  {
    type: 'FREE',
    title: '자유 응원 전광판',
    desc: `기념일이 없는 날에 원하는 날짜를 골라 신청해요. 하루 ${won(PRICE_PER_DAY)}원이며 연속으로도, 나눠서도 고를 수 있어요.`,
    design: { ...defaultDesign('FREE'), name: '내 최애', nickname: '닉네임' },
  },
];

const STEPS = {
  ANNIV: [
    '다음 주에 기념일이 있는 최애를 골라 응원권으로 응원해요.',
    '같은 날 기념일인 최애끼리 응원 수로 겨뤄 1위가 정해져요.',
    '1위 최애를 응원한 분이 전광판을 꾸미고 검수를 요청해요.',
    '승인되면 기념일 당일 홈에 게시돼요.',
  ],
  FREE: [
    '최애와 게시하고 싶은 날짜를 골라요. 기념일이 있는 날과 이미 신청된 날은 고를 수 없어요.',
    `선택한 날짜 수 × ${won(PRICE_PER_DAY)}원을 결제하면 날짜가 확정돼요.`,
    '게시 7일 전 23:59까지 문구와 이미지를 꾸미고 검수를 요청해요.',
    '승인되면 선택한 날짜에 홈에 게시돼요.',
  ],
};

const NOTICES = [
  '기념일 전광판은 응원 포인트 1위 최애가 올라가요. 응원 방법과 마감 일정은 응원 화면에서 확인해 주세요.',
  `자유 응원 전광판은 하루 ${won(PRICE_PER_DAY)}원이에요. 3일을 고르면 ${won(PRICE_PER_DAY * 3)}원이 결제돼요.`,
  '자유 응원 날짜는 먼저 결제한 분이 우선이고, 같은 날짜는 한 분만 신청할 수 있어요.',
  '게시 7일 전 23:59까지 꾸미기와 검수 요청을 마치지 않으면 그날은 비어 있을 수 있어요.',
  '부적절한 문구나 이미지는 검수에서 반려될 수 있어요.',
];

// 전광판 안내 (/fan/guide): 기념일 전광판(응원 순위)과 자유 응원 전광판(날짜 결제) 중 골라 신청한다
export default function FanGuidePage({ onBack, onApplyAnniversary, onApplyFree, onShowRanking, onShowResult, onShowBillboards, onShowTickets }) {
  const [choosing, setChoosing] = useState(false);

  return (
    <DetailShell
      title="응원 전광판"
      ready
      onBack={onBack}
      hero={(
        <section className="bd__hero bd__hero--fan">
          <p className="bd__eyebrow">내 최애를 홈 전광판에</p>
          <h2>{'내 최애를\n전광판에 올려요'}</h2>
        </section>
      )}
      footer={<button className="bd__btn" type="button" onClick={() => setChoosing(true)}>전광판 신청하기</button>}
    >
      {SLOTS.map((slot) => (
        <DetailSection key={slot.type} title={slot.title}>
          <div className="bd__slot-preview"><FanBoard design={slot.design} /></div>
          <p>{slot.desc}</p>
          <ol className="bd__steps">
            {STEPS[slot.type].map((step, index) => (
              <li key={step}>
                <span className="bd__step-no">{index + 1}</span>
                <div><p>{step}</p></div>
              </li>
            ))}
          </ol>
        </DetailSection>
      ))}

      <DetailSection title="응원 전광판 바로가기">
        <button className="bd__link-btn" type="button" onClick={onShowRanking}>기념일 실시간 응원 순위 보기 ›</button>
        <button className="bd__link-btn" type="button" onClick={onShowResult}>내 응원 결과 · 기념일 전광판 꾸미기 ›</button>
        <button className="bd__link-btn" type="button" onClick={onShowBillboards}>내 자유 전광판 · 신청 내역·꾸미기 ›</button>
        <button className="bd__link-btn" type="button" onClick={onShowTickets}>응원권 구매하기 ›</button>
      </DetailSection>

      <DetailSection title="유의사항">
        <NoticeList items={NOTICES} />
      </DetailSection>

      {choosing ? (
        <div className="fan-choice" role="dialog" aria-modal="true" aria-label="전광판 종류 선택">
          <button type="button" className="fan-choice__dim" aria-label="닫기" onClick={() => setChoosing(false)} />
          <div className="fan-choice__sheet">
            <h3>어떤 전광판을 신청할까요?</h3>
            <button type="button" onClick={onApplyAnniversary}>
              <strong>기념일 전광판</strong>
              <span>기념일인 최애를 응원해요. 응원 1위가 당일 게시돼요.</span>
            </button>
            <button type="button" onClick={onApplyFree}>
              <strong>자유 응원 전광판</strong>
              <span>날짜를 골라 결제해요. 하루 {won(PRICE_PER_DAY)}원.</span>
            </button>
          </div>
        </div>
      ) : null}
    </DetailShell>
  );
}
