import FanBoard from '../fan/FanBoard.jsx';
import { fanBoardDesign, isFanBoardType } from '../fan/fanBoardPresets.js';
import { dayChipLabel } from '../fan/fanDayFormat.js';
import BannerArt from './BannerArt.jsx';
import StageBanner from './StageBanner.jsx';

// 오른쪽 아이콘 장식(BannerArt)이 있는 배너 종류
const ART_TYPES = new Set(['SERVICE_INTRO', 'AD', 'EXHIBITION', 'BOX_PROMO', 'FAN_PROMO']);

const DEFAULT_TITLES = {
  SERVICE_INTRO: '내 주변 굿즈샵 재고,\n픽업까지 한 번에',
  EXHIBITION: '12월 생일 최애,\n굿즈로 축하해요',
  FAN_PROMO: '내 최애를\n메인 배너에 올려요',
  BOX_PROMO: '박스를 열면\n한정판 피규어가 나올 수도!',
  KUJI_PROMO: '번호를 뜯으면\nA상 피규어가 내 손에',
};

export default function PromoBanner({ banner, position, dragProps, onOpen, onOpenFanDay }) {
  const type = banner.bannerType;
  const modifier = isFanBoardType(type) ? 'fan' : type.toLowerCase().replaceAll('_', '-');
  // 기념일 전광판(FAN_ANNIV)만 눌러서 "그날 기념일인 최애" 화면으로 갈 수 있다. 자유 응원 전광판은 보기 전용이다.
  const dayLink = (type === 'FAN_ANNIV' || type === 'FAN') && banner.fanDay?.count > 0 ? onOpenFanDay : undefined;
  // 배너는 "자세히 보기" 버튼 없이 배너 아무 곳이나 누르면 상세로 간다.
  const link = dayLink ?? onOpen;
  const image = !isFanBoardType(type) && banner.imageUrl;
  // 이미지가 없는 배너는 오른쪽에 아이콘 장식을 그린다.
  const art = !image && ART_TYPES.has(type);
  // 쿠지 기획전 배너(히로아카·먼작귀 등): 기획전별 색과 굿즈 사진
  const kuji = type === 'KUJI_PROMO' ? banner.kuji : null;

  return (
    <article
      className={`promo-banner promo-banner--${modifier}${image ? ' promo-banner--has-image' : ''}${art ? ' promo-banner--with-art' : ''}${kuji ? ` promo-banner--kuji-${kuji.theme}` : ''}${link ? ' is-link' : ''}`}
      {...(link ? {
        role: 'link',
        tabIndex: 0,
        'aria-label': dayLink
          ? dayChipLabel(banner.fanDay.date, banner.fanDay.count, banner.fanDay.birthdayOnly)
          : (banner.title || DEFAULT_TITLES[type] || '배너').replaceAll('\n', ' '),
        onClick: link,
        onKeyDown: (event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            link();
          }
        },
      } : {})}
      {...dragProps}
    >
      {image ? <img className="promo-banner__image" src={image} alt="" draggable={false} /> : null}
      {type === 'STAGE' ? (
        <StageBanner />
      ) : isFanBoardType(type) ? (
        // 배너 디자인(당첨자가 꾸민 것)은 그대로 둔다.
        <FanBoard
          design={fanBoardDesign(banner)}
          footnote={dayLink ? `${dayChipLabel(banner.fanDay.date, banner.fanDay.count, banner.fanDay.birthdayOnly)} ›` : null}
        />
      ) : (
        <div className="promo-banner__body">
          {type === 'AD' ? (
            <p className="promo-banner__eyebrow">
              <span className="ad-label">AD</span>
              {banner.advertiserName}
            </p>
          ) : null}
          {type === 'FAN_PROMO' ? (
            <p className="promo-banner__eyebrow">
              <span className="promo-banner__live">응원 중 · 이번 주 목요일 마감</span>
            </p>
          ) : null}
          {type === 'BOX_PROMO' ? (
            <p className="promo-banner__eyebrow">랜덤박스 · 최애박스 · 확률 공개</p>
          ) : null}
          <h2>{banner.title || DEFAULT_TITLES[type]}</h2>
          {kuji ? (
            <>
              <p className="promo-banner__kuji-sub">{kuji.subtitle}</p>
              <p className="promo-banner__kuji-line">
                굿즈픽 쿠지 · 1장 {kuji.price.toLocaleString('ko-KR')}원 · 지금 뽑기
              </p>
            </>
          ) : null}
        </div>
      )}
      {art ? <BannerArt type={type} /> : null}
      {kuji ? <span className="kuji-art" style={{ backgroundImage: `url(${kuji.art})` }} aria-hidden="true" /> : null}
      <span className="promo-banner__count">{position}</span>
    </article>
  );
}
