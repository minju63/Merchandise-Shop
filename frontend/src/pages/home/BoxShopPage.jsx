import { useState } from 'react';
import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import { CharacterFace } from './StageSection.jsx';
import { BOX_TIERS, BOXES, LIMITED_LINEUP } from './boxMockData.js';
import './BoxShop.css';

const NOTICES = [
  '등급별 확률은 구성품 1개 기준이며, 박스를 열 때마다 독립적으로 적용돼요.',
  '모든 박스는 구성품 정가 합계가 판매가 이상이에요. 꽝은 없어요.',
  '한정판이 모두 소진되면 같은 등급의 다른 한정 상품으로 대체돼요.',
  '박스는 개봉 전 7일 이내 청약철회할 수 있어요. 개봉 후 단순 변심 환불은 어려워요.',
  '박스를 사면 고른 최애에게 응원 포인트가 쌓여 최애 스테이지 순위에 반영돼요.',
];

// 홈 배너 "랜덤박스·최애박스" 상세 (/box) — 결제 연동 전 시연용
export default function BoxShopPage({ onBack, onBuy }) {
  const [boxId, setBoxId] = useState('random');
  const box = BOXES.find((item) => item.id === boxId);

  return (
    <DetailShell
      title="랜덤박스 · 최애박스"
      ready
      onBack={onBack}
      hero={(
        <div className="box-shop__hero">
          <span className="box-shop__gift" aria-hidden="true">🎁</span>
          <p>이번 시즌 한정판 피규어</p>
          <h2>박스를 열면<br />한정판이 나올 수도!</h2>
          <small>등급별 확률을 모두 공개해요 · 꽝 없음</small>
        </div>
      )}
      footer={(
        <button className="bd__btn" type="button" onClick={() => onBuy(box.id)}>
          {box.title} 사고 최애 응원하기 · {box.price.toLocaleString()}원
        </button>
      )}
    >
      <DetailSection title="박스 고르기" description="박스를 사면 굿즈도 받고 최애에게 응원 포인트도 쌓여요">
        <div className="box-shop__boxes" role="radiogroup" aria-label="박스 종류">
          {BOXES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === boxId}
              className={`box-shop__box${item.id === boxId ? ' active' : ''}`}
              onClick={() => setBoxId(item.id)}
            >
              <b>{item.title}{item.badge ? <em>{item.badge}</em> : null}</b>
              <small>{item.desc}</small>
              <span>{item.price.toLocaleString()}원 · +{item.points.toLocaleString()}P</span>
            </button>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="등급별 확률" description={`${box.title} 구성품 1개 기준`}>
        <ul className="box-shop__odds">
          {Object.entries(box.odds).map(([tier, percent]) => (
            <li key={tier}>
              <span className="box-shop__tier" style={{ background: BOX_TIERS[tier].color }}>{BOX_TIERS[tier].name}</span>
              <span className="box-shop__odds-items">{BOX_TIERS[tier].items.join(' · ')}</span>
              <span className="box-shop__odds-bar"><i style={{ width: `${Math.max(percent, 1.5)}%`, background: BOX_TIERS[tier].color }} /></span>
              <b>{percent}%</b>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="한정판 라인업" description="스페셜·시크릿 등급에서 나와요">
        <div className="box-shop__lineup">
          {LIMITED_LINEUP.map((item) => (
            <div key={item.name} className="box-shop__limited">
              <CharacterFace character={item.character} size={72} />
              <span className="box-shop__tier" style={{ background: BOX_TIERS[item.tier].color }}>{BOX_TIERS[item.tier].name}</span>
              <b>{item.name}</b>
              <small>{item.total}개 한정 · 남은 {item.left}개</small>
            </div>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="꼭 확인해 주세요">
        <NoticeList items={NOTICES} />
      </DetailSection>
    </DetailShell>
  );
}
