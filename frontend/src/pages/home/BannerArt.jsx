// 홈 배너 오른쪽 장식: 유리 느낌 타일 위 라인 아이콘 + 작은 배지 + 반짝이 (이미지가 없는 배너용)
const ICONS = {
  SERVICE_INTRO: (
    <>
      <path d="M3.5 9 5 4.5h14L20.5 9" />
      <path d="M4.5 9v10.5h15V9" />
      <path d="M3.5 9h17" />
      <path d="M9.5 19.5V14h5v5.5" />
    </>
  ),
  AD: (
    <>
      <path d="M6 7.5h12l1 12.5H5L6 7.5Z" />
      <path d="M9 7.5a3 3 0 0 1 6 0" />
    </>
  ),
  EXHIBITION: (
    <>
      <path d="M4.5 13h15v7h-15z" />
      <path d="M6.5 13v-3h11v3" />
      <path d="M12 10V7.5" />
      <path d="M12 4c.9 1 .9 2.2 0 3.2-.9-1-.9-2.2 0-3.2Z" />
      <path d="M4.5 16.5c2 1 3.5-1 5 0s3 1 5 0 3.5-1 5 0" />
    </>
  ),
  BOX_PROMO: (
    <>
      <path d="M4.5 11h15v9h-15z" />
      <path d="M3.5 7.5h17V11h-17z" />
      <path d="M12 7.5V20" />
      <path d="M12 7.5c-1.5-3.5-5-3.5-4.5-1S12 7.5 12 7.5Z" />
      <path d="M12 7.5c1.5-3.5 5-3.5 4.5-1S12 7.5 12 7.5Z" />
    </>
  ),
  FAN_PROMO: (
    <>
      <path d="M3.5 10v4h3l7.5 4.5V5.5L6.5 10Z" />
      <path d="M17 9a4 4 0 0 1 0 6" />
      <path d="M19.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
};

const BADGES = {
  SERVICE_INTRO: '픽업',
  AD: '20%',
  EXHIBITION: '12월',
  BOX_PROMO: '?',
  FAN_PROMO: '♥',
};

export default function BannerArt({ type }) {
  if (!(type in ICONS)) return null;
  return (
    <span className="promo-art" aria-hidden="true">
      <i className="promo-art__spark promo-art__spark--1" />
      <i className="promo-art__spark promo-art__spark--2" />
      <i className="promo-art__spark promo-art__spark--3" />
      <span className="promo-art__tile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {ICONS[type]}
        </svg>
      </span>
      <span className="promo-art__badge">{BADGES[type]}</span>
    </span>
  );
}
