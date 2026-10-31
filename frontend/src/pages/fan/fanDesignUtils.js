// 꾸미기 화면의 순수 함수들 (문구 치환 · 색 변환)
import { DEFAULT_TEXT_POS, MESSAGE_PRESETS, defaultDesign } from './fanBoardPresets.js';

// 색 팔레트 패널의 30색 스와치 (6열 × 5행)
export const PALETTE_30 = [
  '#FFFFFF', '#F2F2F5', '#C9C9D1', '#8A8A94', '#4A4C57', '#111111',
  '#FFD6E8', '#FF7EB0', '#FF5E8A', '#E5484D', '#C8202F', '#4A0812',
  '#FFE3C2', '#FF9A5B', '#FFB020', '#F5D44B', '#9A7634', '#2B2418',
  '#D9F5E3', '#4FD18B', '#1FA898', '#2F7A4F', '#0F3B2E', '#0B3D2E',
  '#CDEBFF', '#4FA8E8', '#3D7BE0', '#16245C', '#0B1230', '#26358A',
];

export const hexToRgb = (hex) => {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : '000000';
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
};

export const rgbToHex = ([r, g, b]) => `#${[r, g, b]
  .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
  .join('')}`.toUpperCase();

export const defaultPosFor = (layout) => ({ ...(DEFAULT_TEXT_POS[layout] ?? DEFAULT_TEXT_POS.none) });

// 추천 문구 탭. 기념일은 응원한 기념일 종류 탭 하나만, 자유는 세 탭.
export function messageTabs(type, kind) {
  if (type === 'ANNIV') return Object.entries(MESSAGE_PRESETS.ANNIV).map(([key, list]) => ({ key, list, active: key === kind }));
  return Object.entries(MESSAGE_PRESETS.FREE).map(([key, list]) => ({ key, list, active: false }));
}

// {n} 은 기념일 데이터의 실제 주년 수로 바꾸고, 수를 모르면 그 문구는 추천에서 뺀다.
export function fillYears(list, years) {
  return list
    .filter((text) => !text.includes('{n}') || Number.isInteger(years))
    .map((text) => text.replace('{n}', String(years)));
}

export function initialMessage(type, kind, years) {
  const tabs = messageTabs(type, kind);
  const first = tabs.find((tab) => tab.active) ?? tabs[0];
  return fillYears(first.list, years)[0] ?? '';
}

// 서버에서 받은 디자인을 기본값과 합친다 (새로 만든 디자인은 {} 에서 시작한다)
export function mergeDesign(type, server, years, kind) {
  const base = defaultDesign(type);
  const merged = { ...base, ...server, bg: { ...base.bg, ...server.bg } };
  if (!server.message) merged.message = initialMessage(type, kind, years);
  if (!server.pos) merged.pos = defaultPosFor(merged.photoLayout);
  if (!server.lineOffsets) merged.lineOffsets = {};
  return merged;
}

// 서버에 보낼 값만 골라낸다 (날짜 줄 · 이름 · 닉네임 · 이미지 URL 은 보내지 않는다)
export function toPayload(design) {
  return {
    bg: { kind: design.bg.kind, presetId: design.bg.presetId ?? null, colors: design.bg.colors },
    photoLayout: design.photoLayout,
    fontId: design.fontId,
    textColor: design.textColor,
    align: design.align,
    pos: design.pos,
    lineOffsets: design.lineOffsets ?? {},
    message: design.message,
  };
}
