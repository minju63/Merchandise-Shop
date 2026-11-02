// LIVE 최애 스테이지 목업 데이터 — 실제 응원 데이터가 쌓이기 전 시연용.
// 캐릭터 그림 대신 판매 중인 정품 굿즈 사진을 쓴다 (사진이 없는 캐릭터는 이름 첫 글자 배지).
const IMAGE_BASE = 'https://twjqulccljimqwggzrpf.supabase.co/storage/v1/object/public/goods-images/products';

export const STAGE_SERIES = {
  JJK: { name: '주술회전', color: '#4b3bb8' },
  KNY: { name: '귀멸의 칼날', color: '#1f8a6a' },
  BLEACH: { name: '블리치', color: '#d2551f' },
  AOT: { name: '진격의 거인', color: '#6b5a3e' },
  OP: { name: '원피스', color: '#c4302b' },
};

export const STAGE_CHARACTERS = [
  { id: 'gojo', name: '고죠 사토루', series: 'JJK', points: 18420, imageUrl: `${IMAGE_BASE}/gojo-plush.png` },
  { id: 'tanjiro', name: '카마도 탄지로', series: 'KNY', points: 17960, imageUrl: `${IMAGE_BASE}/tanjiro-plush-ac92d0737f88.png` },
  { id: 'luffy', name: '몽키 D. 루피', series: 'OP', points: 16810 },
  { id: 'levi', name: '리바이 아커만', series: 'AOT', points: 15230 },
  { id: 'nezuko', name: '카마도 네즈코', series: 'KNY', points: 14470, imageUrl: `${IMAGE_BASE}/nezuko-plush-e63305d6b0fc.png` },
  { id: 'ichigo', name: '쿠로사키 이치고', series: 'BLEACH', points: 12980 },
  { id: 'megumi', name: '후시구로 메구미', series: 'JJK', points: 11540, imageUrl: `${IMAGE_BASE}/fushiguro-plush-cb168bd4a9e6.png` },
  { id: 'shinobu', name: '코쵸우 시노부', series: 'KNY', points: 10260, imageUrl: `${IMAGE_BASE}/shinobu-pigure-bc925b9fdb24.png` },
  { id: 'zoro', name: '롤로노아 조로', series: 'OP', points: 9870 },
  { id: 'eren', name: '에렌 예거', series: 'AOT', points: 9120 },
  // 무대에는 투명 배경(누끼) 캐릭터 이미지를 쓴다 (frontend/public/assets-nukki).
].map((character) => ({ ...character, cutoutUrl: `/assets-nukki/${character.id}-cutout.png` }));

// 실시간 피드에 흘러갈 기여 방법 (무료 응원 100P, 랜덤박스 1,000P, 최애박스 7,500P)
export const STAGE_ACTIONS = [
  { label: '무료 응원', points: 100, weight: 6 },
  { label: '랜덤박스 구매', points: 1000, weight: 3 },
  { label: '최애박스 구매', points: 7500, weight: 1 },
];
