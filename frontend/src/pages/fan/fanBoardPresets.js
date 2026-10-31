// 팬 응원 전광판 디자인 상수. 홈 배너와 꾸미기 미리보기가 같은 값을 쓴다.

export const GRADIENT_PRESETS = [
  { id: 'night', name: '밤하늘', colors: ['#0B1230', '#16245C', '#3D7BE0'] },
  { id: 'pink', name: '핑크', colors: ['#FF7EB0', '#B77CF2', '#7D6BF0'] },
  { id: 'sunset', name: '노을', colors: ['#FF9A5B', '#FF5E8A', '#B04BD9'] },
  { id: 'mint', name: '민트', colors: ['#1FA898', '#4FA8E8'] },
  { id: 'blackgold', name: '블랙골드', colors: ['#121212', '#2B2418', '#9A7634'] },
  { id: 'red', name: '레드', colors: ['#4A0812', '#C8202F'] },
  { id: 'pastel', name: '파스텔', colors: ['#FFD6E8', '#E5DBFF', '#CDEBFF'] },
  { id: 'forest', name: '숲', colors: ['#0F3B2E', '#2F7A4F'] },
  { id: 'mono', name: '모노', colors: ['#1F2028', '#4A4C57'] },
];

export const FONTS = [
  { id: 'noto', name: 'Noto Sans KR', family: "'Noto Sans KR'", weight: 900, query: 'Noto+Sans+KR:wght@900' },
  { id: 'blackhan', name: 'Black Han Sans', family: "'Black Han Sans'", weight: 400, query: 'Black+Han+Sans' },
  { id: 'jua', name: 'Jua', family: "'Jua'", weight: 400, query: 'Jua' },
  { id: 'gaegu', name: 'Gaegu', family: "'Gaegu'", weight: 700, query: 'Gaegu:wght@700' },
  { id: 'myeongjo', name: 'Nanum Myeongjo', family: "'Nanum Myeongjo'", weight: 800, query: 'Nanum+Myeongjo:wght@800' },
  { id: 'dohyeon', name: 'Do Hyeon', family: "'Do Hyeon'", weight: 400, query: 'Do+Hyeon' },
  { id: 'gowun', name: 'Gowun Dodum', family: "'Gowun Dodum'", weight: 400, query: 'Gowun+Dodum' },
  { id: 'sunflower', name: 'Sunflower', family: "'Sunflower'", weight: 700, query: 'Sunflower:wght@700' },
  { id: 'pen', name: 'Nanum Pen Script', family: "'Nanum Pen Script'", weight: 400, query: 'Nanum+Pen+Script' },
  { id: 'gamja', name: 'Gamja Flower', family: "'Gamja Flower'", weight: 400, query: 'Gamja+Flower' },
  { id: 'yeonsung', name: 'Yeon Sung', family: "'Yeon Sung'", weight: 400, query: 'Yeon+Sung' },
  { id: 'dokdo', name: 'Dokdo', family: "'Dokdo'", weight: 400, query: 'Dokdo' },
  { id: 'gugi', name: 'Gugi', family: "'Gugi'", weight: 400, query: 'Gugi' },
  { id: 'songmyung', name: 'Song Myung', family: "'Song Myung'", weight: 400, query: 'Song+Myung' },
];

export const DEFAULT_FONT_ID = 'noto';

export const ANNIVERSARY_KINDS = {
  BIRTHDAY: { label: '생일', tag: 'BIRTHDAY' },
  DEBUT: { label: '데뷔·첫 등장', tag: 'ANNIVERSARY' },
  COMEBACK: { label: '컴백·새 시즌', tag: 'COMEBACK' },
  GOODS: { label: '굿즈 발매', tag: 'NEW GOODS' },
  SEASON: { label: '시즌 인사', tag: 'SEASON GREETINGS' },
};

export const FREE_DATE_LINE = "TODAY'S FAVE";

// 메인 문구 추천. {n} 은 anniversaries 의 실제 주년 수로 바뀐다.
export const MESSAGE_PRESETS = {
  ANNIV: {
    BIRTHDAY: ['HAPPY BIRTHDAY', '생일 축하해!', 'HBD MY FAVE'],
    DEBUT: ['HAPPY ANNIVERSARY', '데뷔 {n}주년 축하해', '첫 등장 {n}주년', 'CONGRATS!'],
    COMEBACK: ['WELCOME BACK', '컴백 축하해!', '새 시즌 축하해', 'NOW ON AIR'],
    GOODS: ['NEW GOODS!', '새 굿즈 나왔다!', '굿즈 발매 축하해'],
    SEASON: ['MERRY CHRISTMAS', 'HAPPY NEW YEAR', '새해 복 많이 받아', 'HAPPY VALENTINE', 'HAPPY HALLOWEEN'],
  },
  FREE: {
    응원: ['MY FAVE', '오늘도 빛나는 중', '늘 응원해', 'FIGHTING!'],
    사랑: ['LOVE YOU', '최애는 최고야', '평생 내 최애'],
    '최애 영업': ['보고 가세요!', '내 최애 좀 봐줘', 'FAVE OF THE DAY'],
  },
};

export const MESSAGE_MAX_LENGTH = 16;

export const TEXT_COLORS = [
  { id: 'white', name: '흰색', value: '#FFFFFF' },
  { id: 'black', name: '검정', value: '#111111' },
  { id: 'lavender', name: '라벤더', value: '#C9C0FF' },
];

// 글자 묶음의 기본 위치(배너 기준 %, 묶음의 왼쪽 가운데). 사진 배치에 따라 달라진다.
export const DEFAULT_TEXT_POS = {
  none: { x: 6, y: 50 },
  left: { x: 42, y: 50 },
  right: { x: 6, y: 50 },
  fill: { x: 6, y: 50 },
};

// 전광판의 글자 줄. 줄마다 따로 끌어서 옮길 수 있다 (옮긴 거리는 lineOffsets 에 배너 너비·높이 대비 %로 저장)
export const BOARD_LINES = ['date', 'message', 'name', 'from'];

// 기본 디자인: 기념일은 밤하늘, 자유 응원은 핑크
export function defaultDesign(type) {
  const preset = GRADIENT_PRESETS[type === 'FREE' ? 1 : 0];
  return {
    type,
    bg: { kind: 'gradient', colors: preset.colors, presetId: preset.id },
    photoLayout: 'none',
    photoUrl: null,
    fontId: DEFAULT_FONT_ID,
    textColor: '#FFFFFF',
    align: 'left',
    pos: { ...DEFAULT_TEXT_POS.none },
    lineOffsets: {},
    dateLine: type === 'FREE' ? FREE_DATE_LINE : '',
    message: type === 'FREE' ? 'MY FAVE' : 'HAPPY BIRTHDAY',
    name: '',
    nickname: '',
  };
}

export function formatDateLine(isoDate, kind) {
  if (!isoDate) return '';
  const tag = ANNIVERSARY_KINDS[kind]?.tag ?? '';
  return `${isoDate.replaceAll('-', '. ')}${tag ? ` · ${tag}` : ''}`;
}

// 구글 웹폰트는 전광판이 처음 그려질 때 한 번만 불러온다.
let fontsRequested = false;
export function ensureFanFonts() {
  if (fontsRequested || typeof document === 'undefined') return;
  fontsRequested = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${FONTS.map((font) => `family=${font.query}`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

// 예전 FAN 배너 컬럼(character_name 등)을 디자인 형태로 바꾼다.
export function legacyFanDesign(banner) {
  return {
    ...defaultDesign('ANNIV'),
    photoLayout: banner.imageUrl ? 'left' : 'none',
    photoUrl: banner.imageUrl,
    pos: { ...DEFAULT_TEXT_POS[banner.imageUrl ? 'left' : 'none'] },
    dateLine: formatDateLine(banner.eventDate, 'BIRTHDAY'),
    message: 'HAPPY BIRTHDAY',
    name: banner.title,
    nickname: banner.fanNickname ?? '',
  };
}

// 전광판 배너: FAN_ANNIV · FAN_FREE (예전 FAN 행은 기념일 전광판으로 본다)
export const isFanBoardType = (type) => ['FAN', 'FAN_ANNIV', 'FAN_FREE'].includes(type);

// 홈에 그릴 디자인. 게시 중인 디자인이 없으면 null 이라 캐러셀에서 빠진다.
export function fanBoardDesign(banner) {
  if (banner.design) return banner.design;
  return banner.bannerType === 'FAN' ? legacyFanDesign(banner) : null;
}
