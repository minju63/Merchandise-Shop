import FanBoard from '../fan/FanBoard.jsx';
import { fanBoardDesign, isFanBoardType } from '../fan/fanBoardPresets.js';

const DEFAULT_TITLES = {
  SERVICE_INTRO: '내 주변 굿즈샵 재고,\n픽업까지 한 번에',
  EXHIBITION: '12월 생일 최애,\n굿즈로 축하해요',
  FAN_PROMO: '내 최애를\n메인 배너에 올려요',
};

function Cta({ onOpen }) {
  return (
    <button className="promo-banner__cta" type="button" onClick={onOpen} disabled={!onOpen}>
      자세히 보기 <b aria-hidden="true">›</b>
    </button>
  );
}

export default function PromoBanner({ banner, position, dragProps, onOpen }) {
  const type = banner.bannerType;
  const modifier = isFanBoardType(type) ? 'fan' : type.toLowerCase().replaceAll('_', '-');

  return (
    <article className={`promo-banner promo-banner--${modifier}`} {...dragProps}>
      {isFanBoardType(type) ? (
        // 전광판은 보기 전용: 자세히 보기도 클릭 이동도 없다.
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
          <h2>{banner.title || DEFAULT_TITLES[type]}</h2>
          <Cta onOpen={onOpen} />
        </div>
      )}
      <span className="promo-banner__count">{position}</span>
    </article>
  );
}
