import { useState } from 'react';
import { DetailSection, DetailShell, NoticeList } from './BannerDetailParts.jsx';
import { CharacterFace } from './StageSection.jsx';
import { BOX_TIERS, BOXES, openBoxes } from './boxMockData.js';
import { STAGE_CHARACTERS, STAGE_SERIES } from './stageMockData.js';
import './StageCheer.css';
import './BoxShop.css';

const FREE_CHEER_KEY = 'goodspick.stage.freeCheerDate';
const MAX_QUANTITY = 10;

const OPTIONS = [
  { id: 'free', title: '무료 응원', desc: '하루 한 번, 구매 없이 응원해요', price: 0, points: 100 },
  ...BOXES.map((box) => ({ ...box, desc: `${box.desc} · 한정판 피규어 확률 있음` })),
];

const NOTICES = [
  '모든 박스는 구성품 정가 합계가 판매가 이상이에요. 꽝은 없어요.',
  '박스 구성 상품 목록·정가·확률은 상품 상세에서 미리 확인할 수 있어요.',
  '이번 주 1위 최애를 응원한 팬 중 기여 포인트에 비례해 경품을 추첨해요. 무료 응원도 추첨 대상이에요.',
  '박스는 개봉 전 7일 이내 청약철회할 수 있어요. 개봉 후 단순 변심 환불은 어려워요.',
  '응원 포인트는 목요일 23:59에 마감되고, 마감 시 1위 최애가 최애 스테이지에 올라요.',
];

function todayKey() {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function readFreeCheerDate() {
  try {
    return window.localStorage.getItem(FREE_CHEER_KEY);
  } catch {
    return null;
  }
}

// 최애 스테이지의 "응원하기" 화면 (/stage/cheer?character=gojo) — 결제 연동 전 시연용
export default function StageCheerPage({ initialCharacterId, initialOptionId, onBack, onHome }) {
  const [characterId, setCharacterId] = useState(
    STAGE_CHARACTERS.some((character) => character.id === initialCharacterId) ? initialCharacterId : STAGE_CHARACTERS[0].id,
  );
  const [optionId, setOptionId] = useState(OPTIONS.some((option) => option.id === initialOptionId) ? initialOptionId : 'pick');
  const [quantity, setQuantity] = useState(1);
  const [freeUsedToday, setFreeUsedToday] = useState(() => readFreeCheerDate() === todayKey());
  const [done, setDone] = useState(null);

  const character = STAGE_CHARACTERS.find((item) => item.id === characterId);
  const option = OPTIONS.find((item) => item.id === optionId);
  const count = option.price ? quantity : 1;
  const totalPrice = option.price * count;
  const totalPoints = option.points * count;
  const freeBlocked = option.id === 'free' && freeUsedToday;

  const handleSubmit = () => {
    if (freeBlocked) return;
    if (option.id === 'free') {
      try {
        window.localStorage.setItem(FREE_CHEER_KEY, todayKey());
      } catch {
        // 저장이 막혀도 이번 화면에서는 사용한 것으로 처리한다.
      }
      setFreeUsedToday(true);
    }
    setDone({
      name: character.name,
      points: totalPoints,
      title: option.title,
      count,
      items: option.price ? openBoxes(option.id, count, character.id) : [],
    });
  };

  if (done) {
    return (
      <DetailShell title="최애 응원하기" ready onBack={onBack}>
        <div className="stage-cheer__done">
          <CharacterFace character={character} size={96} />
          <h2>{done.name}에게<br />{done.points.toLocaleString()}P를 응원했어요</h2>
          <p>{done.title}{done.count > 1 ? ` ${done.count}개` : ''} · 시연용 화면이라 실제 결제는 진행되지 않았어요.</p>
          {done.items.length ? (
            <ul className="box-results" aria-label="박스에서 나온 굿즈">
              {done.items.map((result, index) => (
                <li
                  key={result.key}
                  className={result.tier === 'SPECIAL' || result.tier === 'SECRET' ? 'box-results--limited' : ''}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <span className="box-shop__tier" style={{ background: BOX_TIERS[result.tier].color }}>{BOX_TIERS[result.tier].name}</span>
                  <span>
                    <b>{result.character.name} {result.item}</b>
                    <small>{STAGE_SERIES[result.character.series].name}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="stage-cheer__done-actions">
            <button className="bd__btn" type="button" onClick={onHome}>최애 스테이지 보기</button>
            <button className="bd__btn bd__btn--secondary" type="button" onClick={() => setDone(null)}>더 응원하기</button>
          </div>
        </div>
      </DetailShell>
    );
  }

  return (
    <DetailShell
      title="최애 응원하기"
      ready
      onBack={onBack}
      hero={(
        <div className="stage-cheer__hero">
          <CharacterFace character={character} size={84} />
          <div>
            <small>{STAGE_SERIES[character.series].name}</small>
            <strong>{character.name}</strong>
            <span>이번 주 {character.points.toLocaleString()}P</span>
          </div>
        </div>
      )}
      footer={(
        <button className="bd__btn" type="button" onClick={handleSubmit} disabled={freeBlocked}>
          {freeBlocked
            ? '오늘 무료 응원을 이미 했어요'
            : option.price
              ? `${totalPrice.toLocaleString()}원 결제하고 ${totalPoints.toLocaleString()}P 응원`
              : `무료로 ${totalPoints}P 응원`}
        </button>
      )}
    >
      <DetailSection title="응원할 최애" description="포인트는 고른 최애에게 들어가요">
        <div className="stage-cheer__characters" role="radiogroup" aria-label="응원할 최애">
          {STAGE_CHARACTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === characterId}
              className={item.id === characterId ? 'active' : ''}
              onClick={() => setCharacterId(item.id)}
            >
              <CharacterFace character={item} size={52} />
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      </DetailSection>

      <DetailSection title="응원 방법" description="박스를 사면 굿즈도 받고 최애에게 포인트도 쌓여요">
        <div className="stage-cheer__options" role="radiogroup" aria-label="응원 방법">
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={item.id === optionId}
              className={`stage-cheer__option${item.id === optionId ? ' active' : ''}`}
              onClick={() => setOptionId(item.id)}
            >
              <span className="stage-cheer__option-main">
                <b>{item.title}{item.badge ? <em>{item.badge}</em> : null}</b>
                <small>{item.id === 'free' && freeUsedToday ? '오늘은 이미 응원했어요 · 내일 다시 가능' : item.desc}</small>
              </span>
              <span className="stage-cheer__option-side">
                <b>{item.price ? `${item.price.toLocaleString()}원` : '무료'}</b>
                <small>+{item.points.toLocaleString()}P</small>
              </span>
            </button>
          ))}
        </div>

        {option.price ? (
          <div className="stage-cheer__quantity">
            <span>수량</span>
            <div>
              <button type="button" aria-label="수량 줄이기" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity <= 1}>−</button>
              <output aria-live="polite">{quantity}</output>
              <button type="button" aria-label="수량 늘리기" onClick={() => setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))} disabled={quantity >= MAX_QUANTITY}>+</button>
            </div>
          </div>
        ) : null}

        <dl className="stage-cheer__summary">
          <div><dt>결제 금액</dt><dd>{option.price ? `${totalPrice.toLocaleString()}원` : '무료'}</dd></div>
          <div><dt>{character.name}에게 응원</dt><dd className="points">+{totalPoints.toLocaleString()}P</dd></div>
          <div><dt>경품 응모</dt><dd>1위 시 기여 포인트 비례 추첨</dd></div>
        </dl>
      </DetailSection>

      <DetailSection title="꼭 확인해 주세요">
        <NoticeList items={NOTICES} />
      </DetailSection>
    </DetailShell>
  );
}
