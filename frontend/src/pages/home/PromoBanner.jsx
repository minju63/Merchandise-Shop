import FanBoard from '../fan/FanBoard.jsx';
import { fanBoardDesign, isFanBoardType } from '../fan/fanBoardPresets.js';
import { dayChipLabel } from '../fan/fanDayFormat.js';

const DEFAULT_TITLES = {
  SERVICE_INTRO: '내 주변 굿즈샵 재고,\n픽업까지 한 번에',
  EXHIBITION: '12월 생일 최애,\n굿즈로 축하해요',
  FAN_PROMO: '내 최애를\n메인 배너에 올려요',
  BOX_PROMO: '박스를 열면\n한정판 피규어가 나올 수도!',
};

function Cta({ onOpen }) {
  return (
    <button className="promo-banner__cta" type="button" onClick={onOpen} disabled={!onOpen}>
      자세히 보기 <b aria-hidden="true">›</b>
    </button>
  );
}

export default function PromoBanner({ banner, position, dragProps, onOpen, onOpenFanDay }) {
  const type = banner.bannerType;
  const modifier = isFanBoardType(type) ? 'fan' : type.toLowerCase().replaceAll('_', '-');
  // 기념일 전광판(FAN_ANNIV)만 눌러서 "그날 기념일인 최애" 화면으로 갈 수 있다. 자유 응원 전광판은 보기 전용이다.
  const dayLink = (type === 'FAN_ANNIV' || type === 'FAN') && banner.fanDay?.count > 0 ? onOpenFanDay : undefined;
  const image = !isFanBoardType(type) && banner.imageUrl;

  return (
    <article
      className={`promo-banner promo-banner--${modifier}${image ? ' promo-banner--has-image' : ''}${dayLink ? ' is-link' : ''}`}
      {...(dayLink ? {
        role: 'link',
        tabIndex: 0,
        'aria-label': dayChipLabel(banner.fanDay.date, banner.fanDay.count, banner.fanDay.birthdayOnly),
        onClick: dayLink,
        onKeyDown: (event) => {
          if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            dayLink();
          }
        },
      } : {})}
      {...dragProps}
    >
      {image ? <img className="promo-banner__image" src={image} alt="" draggable={false} /> : null}
      {isFanBoardType(type) ? (
        // 배너 디자인(당첨자가 꾸민 것)은 그대로 둔다.
        <FanBoard design={fanBoardDesign(banner)} />
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
          {type === 'BOX_PROMO' ? <span className="promo-banner__box-art" aria-hidden="true">🎁</span> : null}
          <Cta onOpen={onOpen} />
        </div>
      )}
      {dayLink ? (
        <span className="promo-banner__day">
          {dayChipLabel(banner.fanDay.date, banner.fanDay.count, banner.fanDay.birthdayOnly)} <b aria-hidden="true">›</b>
        </span>
      ) : null}
      <span className="promo-banner__count">{position}</span>
    </article>
  );
}
