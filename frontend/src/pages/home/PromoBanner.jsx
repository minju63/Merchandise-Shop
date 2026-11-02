import FanBoard from '../fan/FanBoard.jsx';
import StageSection from './StageSection.jsx';
import Icon from '../../components/Icon.jsx';
import { fanBoardDesign, isFanBoardType } from '../fan/fanBoardPresets.js';

const DEFAULT_TITLES = {
  SERVICE_INTRO: '내 주변 굿즈샵 재고,\n픽업까지 한 번에',
  EXHIBITION: '12월 생일 최애,\n굿즈로 축하해요',
  FAN_PROMO: '내 최애를\n메인 배너에 올려요',
  BOX_PROMO: '박스를 열면\n한정판 피규어가 나올 수도!',
};

const BANNER_ICONS = {
  SERVICE_INTRO: ['store', 'pin'],
  AD: ['bag', 'store'],
  EXHIBITION: ['gift', 'heart'],
  FAN_PROMO: ['heart', 'mic'],
  BOX_PROMO: ['gift', 'character'],
};

function BannerArt({ type }) {
  const icons = BANNER_ICONS[type];
  if (!icons) return null;
  return (
    <div className="promo-banner__art" aria-hidden="true">
      <span className="promo-banner__art-halo" />
      <span className="promo-banner__art-card"><Icon name={icons[0]} size={80} /></span>
      <span className="promo-banner__art-badge"><Icon name={icons[1]} size={28} /></span>
      <span className="promo-banner__art-spark promo-banner__art-spark--one">✦</span>
      <span className="promo-banner__art-spark promo-banner__art-spark--two">✧</span>
    </div>
  );
}

function Cta({ onOpen }) {
  return (
    <button className="promo-banner__cta" type="button" onClick={onOpen} disabled={!onOpen}>
      자세히 보기 <b aria-hidden="true">›</b>
    </button>
  );
}

export default function PromoBanner({ banner, position, dragProps, onOpen, onStageCheer, onStageGuide }) {
  const type = banner.bannerType;
  const modifier = isFanBoardType(type) ? 'fan' : type.toLowerCase().replaceAll('_', '-');
  const image = !isFanBoardType(type) && banner.imageUrl;

  return (
    <article
      className={`promo-banner promo-banner--${modifier}${image ? ' promo-banner--has-image' : ''}`}
      {...dragProps}
    >
      {image ? <img className="promo-banner__image" src={image} alt="" draggable={false} /> : null}
      {type === 'STAGE' ? (
        <StageSection compact onCheer={onStageCheer} onOpenGuide={onStageGuide} />
      ) : isFanBoardType(type) ? (
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
          {type === 'BOX_PROMO' ? (
            <p className="promo-banner__eyebrow">랜덤박스 · 최애박스 · 확률 공개</p>
          ) : null}
          <h2>{banner.title || DEFAULT_TITLES[type]}</h2>
          {!image ? <BannerArt type={type} /> : null}
          <Cta onOpen={onOpen} />
        </div>
      )}
      <span className="promo-banner__count">{position}</span>
    </article>
  );
}
