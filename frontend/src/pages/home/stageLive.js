// LIVE 최애 스테이지 순위 — 홈 배너와 스테이지 화면이 같은 순위를 보도록 화면 밖에 한 벌만 둔다 (시연용 목업).
import { useEffect, useState } from 'react';
import { STAGE_ACTIONS, STAGE_CHARACTERS } from './stageMockData.js';

const TICK_MS = 1600;

let characters = STAGE_CHARACTERS.map((character) => ({ ...character }));
let previousRanks = {};
let feed = null;
let timer = null;
const listeners = new Set();

export function rankCharacters(list) {
  return [...list].sort((a, b) => b.points - a.points);
}

function pickAction() {
  const total = STAGE_ACTIONS.reduce((sum, action) => sum + action.weight, 0);
  let roll = Math.random() * total;
  return STAGE_ACTIONS.find((action) => (roll -= action.weight) < 0) ?? STAGE_ACTIONS[0];
}

function tick() {
  const target = STAGE_CHARACTERS[Math.floor(Math.random() * STAGE_CHARACTERS.length)];
  const action = pickAction();
  previousRanks = Object.fromEntries(rankCharacters(characters).map((character, index) => [character.id, index]));
  characters = characters.map((character) => (
    character.id === target.id ? { ...character, points: character.points + action.points } : character
  ));
  feed = { key: Date.now(), id: target.id, text: `${action.label} → ${target.name} +${action.points.toLocaleString()}P` };
  listeners.forEach((listener) => listener());
}

// 내 응원(무료 응원 · 박스 구매)을 순위에 바로 반영한다. 시연용이라 새로고침하면 처음 값으로 돌아간다.
export function addCheer(characterId, points, label = '내 응원') {
  const target = characters.find((character) => character.id === characterId);
  if (!target || !(points > 0)) return;
  previousRanks = Object.fromEntries(rankCharacters(characters).map((character, index) => [character.id, index]));
  characters = characters.map((character) => (
    character.id === characterId ? { ...character, points: character.points + points } : character
  ));
  feed = { key: Date.now(), id: characterId, text: `${label} → ${target.name} +${points.toLocaleString()}P` };
  listeners.forEach((listener) => listener());
}

// 지난 순위 대비 변동 (양수 = 오름)
export function rankMove(id, rank) {
  return id in previousRanks ? previousRanks[id] - rank : 0;
}

// 보는 화면이 하나라도 있을 때만 순위가 움직인다.
export function useLiveStage() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion((version) => version + 1);
    listeners.add(listener);
    if (!timer) timer = setInterval(tick, TICK_MS);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
  return { characters, ranked: rankCharacters(characters), feed };
}

// 이번 주 목요일 23:59:59 (한국 시간) 마감
export function nextDeadline(now) {
  const kst = new Date(now + 9 * 3600 * 1000);
  const daysUntilThursday = (4 - kst.getUTCDay() + 7) % 7;
  const deadline = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + daysUntilThursday, 23, 59, 59);
  return deadline - 9 * 3600 * 1000;
}

export function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const time = [Math.floor((total % 86400) / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
  return `${days}일 ${time}`;
}

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
