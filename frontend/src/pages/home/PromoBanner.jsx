const formatEventDate = (value) => (value ? value.replaceAll('-', '. ') : '');

function Cta({ onOpen }) {
  return (
    <button className="promo-banner__cta" type="button" onClick={onOpen} disabled={!onOpen}>
      자세히 보기 <b aria-hidden="true">›</b>
    </button>
  );
}

// 팬 응원 전광판: 보기만 하는 축하 배너라 버튼도 클릭 이동도 없다.
function FanBanner({ banner }) {
  const hashtag = `#${banner.characterName?.replace(/\s/g, '')}_생일축하해`;

  return (
    <>
      <div className="promo-banner__fan-image">
        {banner.imageUrl ? <img src={banner.imageUrl} alt="" draggable="false" /> : null}
      </div>
      <div className="promo-banner__fan-text">
        <span className="promo-banner__fan-badge">팬 응원</span>
        <time className="promo-banner__fan-date">{formatEventDate(banner.eventDate)}</time>
        <p className="promo-banner__fan-title">HAPPY<br />BIRTHDAY</p>
        <p className="promo-banner__fan-name">{banner.title}</p>
        <p className="promo-banner__fan-message">{banner.message}</p>
        <p className="promo-banner__fan-from">from. {banner.fanNickname} · {hashtag}</p>
      </div>
      <i className="promo-banner__star promo-banner__star--1" aria-hidden="true" />
      <i className="promo-banner__star promo-banner__star--2" aria-hidden="true" />
      <i className="promo-banner__star promo-banner__star--3" aria-hidden="true" />
    </>
  );
}

export default function PromoBanner({ banner, position, dragProps, onOpen }) {
  const type = banner.bannerType;

  return (
    <article className={`promo-banner promo-banner--${type.toLowerCase().replace('_', '-')}`} {...dragProps}>
      {type === 'FAN' ? (
        <FanBanner banner={banner} />
      ) : (
        <div className="promo-banner__body">
          {type === 'AD' ? (
            <p className="promo-banner__eyebrow">
              <span className="ad-label">AD</span>
              {banner.advertiserName}
            </p>
          ) : null}
          <h2>{banner.title}</h2>
          <Cta onOpen={onOpen} />
        </div>
      )}
      <span className="promo-banner__count">{position}</span>
    </article>
  );
}
