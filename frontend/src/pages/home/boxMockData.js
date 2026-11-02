// 랜덤박스·최애박스 목업 데이터 — 실제 박스 재고·확률 테이블이 생기기 전 시연용.
import { STAGE_CHARACTERS } from './stageMockData.js';

export const BOX_TIERS = {
  NORMAL: { name: '일반', color: '#8a8595', items: ['아크릴 키링', '포토카드 세트', '홀로그램 스티커', '캔뱃지'] },
  RARE: { name: '레어', color: '#3b82f6', items: ['아크릴 스탠드', '캔뱃지 5종 세트', '미니 쿠션'] },
  SPECIAL: { name: '스페셜', color: '#9b5de5', items: ['한정판 미니 피규어'] },
  SECRET: { name: '시크릿', color: '#e0a106', items: ['넘버링 한정 피규어'] },
};

// 확률(%)은 박스 1개를 열 때 한 칸(구성품 1개)에 적용된다. 각 박스 합계 100.
export const BOXES = [
  {
    id: 'random',
    title: '랜덤박스',
    price: 10000,
    points: 1000,
    slots: 3,
    desc: '여러 작품 굿즈 3개가 랜덤으로 들어 있어요',
    odds: { NORMAL: 82, RARE: 15, SPECIAL: 2.5, SECRET: 0.5 },
  },
  {
    id: 'pick',
    title: '최애박스',
    price: 50000,
    points: 7500,
    slots: 5,
    desc: '고른 최애의 굿즈 5개로만 구성돼요',
    badge: '최애 굿즈 확정',
    odds: { NORMAL: 70, RARE: 22, SPECIAL: 6.5, SECRET: 1.5 },
  },
];

// 이번 시즌 한정판 라인업 (총 수량 / 남은 수량)
export const LIMITED_LINEUP = STAGE_CHARACTERS.filter((character) => character.imageUrl).map((character, index) => ({
  character,
  tier: index === 0 ? 'SECRET' : 'SPECIAL',
  name: index === 0 ? `${character.name} 넘버링 한정 피규어` : `${character.name} 한정판 미니 피규어`,
  total: index === 0 ? 100 : 300,
  left: [37, 182, 211, 96, 254][index] ?? 150,
}));

function rollTier(odds) {
  let roll = Math.random() * 100;
  return Object.keys(odds).find((tier) => (roll -= odds[tier]) < 0) ?? 'NORMAL';
}

// 박스를 count 개 열었을 때 나온 구성품. 최애박스는 고른 최애, 랜덤박스는 아무 캐릭터 굿즈가 나온다.
export function openBoxes(boxId, count, characterId) {
  const box = BOXES.find((item) => item.id === boxId);
  const results = [];
  for (let i = 0; i < count * box.slots; i += 1) {
    const tier = rollTier(box.odds);
    const character = box.id === 'pick'
      ? STAGE_CHARACTERS.find((item) => item.id === characterId)
      : STAGE_CHARACTERS[Math.floor(Math.random() * STAGE_CHARACTERS.length)];
    const pool = BOX_TIERS[tier].items;
    results.push({ key: i, tier, character, item: pool[Math.floor(Math.random() * pool.length)] });
  }
  const order = Object.keys(BOX_TIERS).reverse();
  return results.sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
}
