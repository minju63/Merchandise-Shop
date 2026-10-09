import { useEffect, useRef, useState } from 'react';
import ProductCard from '../../components/ProductCard.jsx';
import UpcomingProductCard from '../../components/UpcomingProductCard.jsx';
import './HomePage.css';

const iconPaths = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  cart: <><path d="M3 4h2l2.2 11h9.9l2-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></>,
  mic: <><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3Z" /></>,
  card: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 11h5M8 15h8" /></>,
  link: <><path d="m9.5 14.5 5-5M7.3 17.7l-1 1a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M16.7 6.3l1-1a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  shop: <><path d="M4 9h16l-1-5H5L4 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6M4 9c0 2 3 3 4 0 0 2 3 3 4 0 0 2 3 3 4 0 0 2 3 3 4 0" /></>,
  category: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  heart: <path d="M20.8 4.6a5.4 5.4 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.7Z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

function Icon({ name, size = 24 }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{iconPaths[name]}</svg>;
}

function HorizontalRail({ children, className, ariaLabel }) {
  const rail = useRef(null);
  const dragState = useRef({ active: false, moved: false, startX: 0, scrollLeft: 0 });

  const moveRail = (direction) => {
    rail.current?.scrollBy({
      left: direction * Math.max(240, rail.current.clientWidth * 0.8),
      behavior: 'smooth',
    });
  };

  const handlePointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button')) return;

    dragState.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
    };
    event.currentTarget.classList.add('is-dragging');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragState.current.active) return;
    const distance = event.clientX - dragState.current.startX;
    if (Math.abs(distance) > 3) dragState.current.moved = true;
    event.currentTarget.scrollLeft = dragState.current.scrollLeft - distance;
  };

  const stopDragging = (event) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    event.currentTarget.classList.remove('is-dragging');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleClickCapture = (event) => {
    if (!dragState.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragState.current.moved = false;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') moveRail(-1);
    if (event.key === 'ArrowRight') moveRail(1);
  };

  return (
    <div className="horizontal-rail">
      <div
        className={className}
        ref={rail}
        aria-label={ariaLabel}
        tabIndex="0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onClickCapture={handleClickCapture}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}

function ProductRail({ products, ranked = false, compact = false, onProductClick }) {
  return (
    <HorizontalRail className="product-rail" ariaLabel="상품 목록">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          rank={ranked ? index + 1 : undefined}
          compact={compact}
          onClick={onProductClick ? () => onProductClick(product) : undefined}
        />
      ))}
    </HorizontalRail>
  );
}

export default function HomePage({
  data,
  isAuthenticated = false,
  interestCategoryIds = [],
  alertedProductIds = [],
  onBannerImpression,
  onBannerClick,
  onNavigate,
  onSearch,
  onRequestLogin,
  onLogin,
  onOpenInterestSettings,
  onOpenProduct,
  onToggleOpenAlert,
}) {
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeProductTab, setActiveProductTab] = useState('popular');
  const [autoSlideVersion, setAutoSlideVersion] = useState(0);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => new Date().getTime());
  const lastImpressionId = useRef(null);
  const bannerDragState = useRef({ active: false, moved: false, startX: 0 });
  const visibleBanners = data.banners.filter((banner) => {
    return new Date(banner.startAt).getTime() <= currentTimestamp
      && currentTimestamp <= new Date(banner.endAt).getTime();
  });
  const normalizedBannerIndex = visibleBanners.length
    ? activeBannerIndex % visibleBanners.length
    : 0;
  const activeBanner = visibleBanners[normalizedBannerIndex];
  const activeBannerId = activeBanner?.id;
  const homeCategories = data.categories
    .filter((category) => category.isHomeShortcut)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 5);
  const openedUpcomingProducts = data.upcomingProducts
    .filter((product) => new Date(product.openAt).getTime() <= currentTimestamp)
    .map((product) => ({ ...product, isNew: true, releasedAt: product.openAt, status: 'ON_SALE' }));
  const upcomingDeadline = currentTimestamp + 14 * 24 * 60 * 60 * 1000;
  const upcomingProducts = data.upcomingProducts
    .filter((product) => {
      const openTimestamp = new Date(product.openAt).getTime();
      return product.status === 'UPCOMING'
        && currentTimestamp < openTimestamp
        && openTimestamp <= upcomingDeadline;
    })
    .sort((a, b) => {
      const timeDifference = new Date(a.openAt) - new Date(b.openAt);
      return timeDifference || b.alertCount - a.alertCount;
    })
    .slice(0, 10);
  const popularProducts = [...data.popularProducts]
    .sort((a, b) => b.popularityScore - a.popularityScore);
  const newProducts = [...data.newProducts, ...openedUpcomingProducts]
    .sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt));
  const lowStockProducts = data.lowStockProducts
    .filter((product) => product.stockQuantity >= 1 && product.stockQuantity <= 10)
    .sort((a, b) => a.stockQuantity - b.stockQuantity);
  const activeProducts = activeProductTab === 'popular' ? popularProducts : newProducts;
  const activeInterestCategoryIds = isAuthenticated ? interestCategoryIds : [];
  const activeInterestCategories = activeInterestCategoryIds.map((categoryId) => (
    data.categories.find((category) => category.id === categoryId)
  )).filter(Boolean);
  const personalizedRecommendations = (data.recommendationProducts ?? [])
    .filter((product) => product.interestCategoryIds?.some((categoryId) => (
      activeInterestCategoryIds.includes(categoryId)
    )));
  const hasInterests = activeInterestCategoryIds.length > 0;

  useEffect(() => {
    const clock = window.setInterval(() => setCurrentTimestamp(new Date().getTime()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (visibleBanners.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setActiveBannerIndex((current) => (current + 1) % visibleBanners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [visibleBanners.length, autoSlideVersion]);

  useEffect(() => {
    if (activeBannerId && lastImpressionId.current !== activeBannerId) {
      lastImpressionId.current = activeBannerId;
      onBannerImpression?.(activeBannerId);
    }
  }, [activeBannerId, onBannerImpression]);

  const handleBannerAction = () => {
    if (!activeBanner || !onNavigate) return;
    onBannerClick?.(activeBanner.id);
    onNavigate({ type: activeBanner.linkType, value: activeBanner.linkValue });
  };

  const showBanner = (index) => {
    if (!visibleBanners.length) return;
    setActiveBannerIndex((index + visibleBanners.length) % visibleBanners.length);
    setAutoSlideVersion((version) => version + 1);
  };

  const moveBanner = (direction) => {
    showBanner(normalizedBannerIndex + direction);
  };

  const handleBannerPointerDown = (event) => {
    if ((event.pointerType === 'mouse' && event.button !== 0) || event.target.closest('button')) {
      return;
    }

    bannerDragState.current = { active: true, moved: false, startX: event.clientX };
    event.currentTarget.classList.add('is-dragging');
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBannerPointerMove = (event) => {
    if (!bannerDragState.current.active) return;
    const distance = event.clientX - bannerDragState.current.startX;
    if (Math.abs(distance) > 3) bannerDragState.current.moved = true;
    event.currentTarget.style.transform = `translateX(${distance * 0.35}px)`;
  };

  const resetBannerDrag = (event) => {
    bannerDragState.current.active = false;
    event.currentTarget.classList.remove('is-dragging');
    event.currentTarget.style.transform = '';
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleBannerPointerUp = (event) => {
    if (!bannerDragState.current.active) return;
    const distance = event.clientX - bannerDragState.current.startX;
    resetBannerDrag(event);

    if (Math.abs(distance) < 40) return;
    moveBanner(distance < 0 ? 1 : -1);
  };

  const handleBannerClickCapture = (event) => {
    if (!bannerDragState.current.moved) return;
    event.preventDefault();
    event.stopPropagation();
    bannerDragState.current.moved = false;
  };

  const handleOpenAlert = (product) => {
    if (!isAuthenticated) {
      onRequestLogin?.();
      return;
    }

    onToggleOpenAlert?.(product);
  };

  const alertActionAvailable = isAuthenticated
    ? Boolean(onToggleOpenAlert)
    : Boolean(onRequestLogin);

  return (
    <div className="home-shell">
      <header className="home-header">
        <div className="header-row">
          <h1>굿즈<span>픽</span></h1>
          <div className="header-actions">
            <button type="button" aria-label="통합 검색" onClick={onSearch} disabled={!onSearch}><Icon name="search" size={21} /></button>
            <button type="button" aria-label="알림 목록 화면 준비 중" disabled>
              <Icon name="bell" size={21} />
              <span className="action-badge">{data.badges.notifications}</span>
            </button>
            <button type="button" aria-label="장바구니 화면 준비 중" disabled>
              <Icon name="cart" size={22} />
              <span className="action-badge">{data.badges.cart}</span>
            </button>
          </div>
        </div>
        <button className="search-field" type="button" onClick={onSearch} disabled={!onSearch}>
          <Icon name="search" size={17} />
          <span>굿즈명, 작품명, 캐릭터, 굿즈샵 검색</span>
        </button>
      </header>

      <main>
        <section className="banner-section" aria-label="이벤트, 프로모션 및 광고">
          {activeBanner ? (
            <article
              className={`promo-banner promo-banner--${activeBanner.tone}`}
              key={activeBanner.id}
              onPointerDown={handleBannerPointerDown}
              onPointerMove={handleBannerPointerMove}
              onPointerUp={handleBannerPointerUp}
              onPointerCancel={resetBannerDrag}
              onClickCapture={handleBannerClickCapture}
            >
              <div>
                <p className="promo-banner__eyebrow">
                  {activeBanner.type === 'AD' ? <span className="ad-label">AD</span> : null}
                  {activeBanner.eyebrow}
                </p>
                <h2>{activeBanner.title}</h2>
                <button
                  className="promo-banner__cta"
                  type="button"
                  onClick={handleBannerAction}
                  disabled={!onNavigate}
                >
                  {activeBanner.cta} <b aria-hidden="true">›</b>
                </button>
              </div>
              <div className="promo-banner__art" aria-hidden="true"><i /><i /></div>
              <span className="promo-banner__count">
                {normalizedBannerIndex + 1} / {visibleBanners.length}
              </span>
            </article>
          ) : null}
          <div className="banner-dots" aria-label="배너 선택">
            {visibleBanners.map((banner, index) => (
              <button
                className={index === normalizedBannerIndex ? 'active' : ''}
                type="button"
                key={banner.id}
                aria-label={`${index + 1}번째 배너 보기`}
                aria-current={index === normalizedBannerIndex ? 'true' : undefined}
                onClick={() => showBanner(index)}
              />
            ))}
          </div>
        </section>

        <nav className="category-shortcuts" aria-label="카테고리 바로가기">
          {homeCategories.map((category) => (
            <button type="button" key={category.id} disabled>
              <span className="category-shortcuts__icon"><Icon name={category.icon} size={22} /></span>
              <span>{category.name}</span>
            </button>
          ))}
        </nav>

        <section className="home-section trending-section">
          <div className="section-heading">
            <div><h2>지금 뜨는 굿즈</h2><p>요즘 가장 주목받는 상품이에요</p></div>
            <button type="button" disabled>전체보기 <span aria-hidden="true">›</span></button>
          </div>
          <div className="product-tabs" role="tablist" aria-label="상품 정렬 기준">
            <button
              className={activeProductTab === 'popular' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={activeProductTab === 'popular'}
              onClick={() => setActiveProductTab('popular')}
            >인기</button>
            <button
              className={activeProductTab === 'new' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={activeProductTab === 'new'}
              onClick={() => setActiveProductTab('new')}
            >신상품</button>
          </div>
          <ProductRail products={activeProducts} ranked={activeProductTab === 'popular'} />
        </section>

        <section className="home-section recommendation-section">
          {isAuthenticated && hasInterests ? (
            <>
              <div className="section-heading">
                <div>
                  <h2>회원님을 위한 추천</h2>
                  <p>선택한 관심 카테고리의 상품을 모았어요</p>
                </div>
                <button
                  type="button"
                  onClick={onOpenInterestSettings}
                  disabled={!onOpenInterestSettings}
                >관심사 설정</button>
              </div>
              <div className="filter-chips" aria-label="선택한 관심 카테고리">
                {activeInterestCategories.map((category) => (
                  <span className="active" key={category.id}>{category.name}</span>
                ))}
              </div>
              {personalizedRecommendations.length > 0 ? (
                <ProductRail
                  products={personalizedRecommendations.slice(0, 10)}
                  onProductClick={onOpenProduct}
                />
              ) : (
                <p className="recommendation-section__no-match">
                  관심 카테고리의 상품을 준비 중이에요
                </p>
              )}
            </>
          ) : (
            <div className="recommendation-section__notice">
              <span className="recommendation-section__notice-icon" aria-hidden="true">♡</span>
              <h2>{isAuthenticated ? '어떤 굿즈를 좋아하세요?' : '취향에 맞는 굿즈를 만나보세요'}</h2>
              <p>
                {isAuthenticated
                  ? '관심 카테고리를 선택하면 취향에 맞는 굿즈를 추천해드려요.'
                  : '로그인하고 관심 카테고리를 설정해보세요.'}
              </p>
              <button
                type="button"
                onClick={isAuthenticated ? onOpenInterestSettings : onLogin}
                disabled={isAuthenticated ? !onOpenInterestSettings : !onLogin}
              >{isAuthenticated ? '관심사 설정' : '로그인하기'}</button>
            </div>
          )}
        </section>

        <section className="home-section upcoming-section">
          <div className="section-heading">
            <div>
              <h2>입고 예정 상품</h2>
              <p>오픈 시각이 가까운 순 · 알림 받고 놓치지 마세요</p>
            </div>
            <button type="button" disabled>전체보기 <span aria-hidden="true">›</span></button>
          </div>
          <HorizontalRail className="upcoming-rail" ariaLabel="입고 예정 상품 목록">
            {upcomingProducts.map((product) => (
              <UpcomingProductCard
                key={product.id}
                product={product}
                currentTimestamp={currentTimestamp}
                isAlerted={alertedProductIds.includes(product.id)}
                alertActionAvailable={alertActionAvailable}
                onAlertClick={handleOpenAlert}
              />
            ))}
          </HorizontalRail>
        </section>

        <section className="home-section">
          <div className="section-heading">
            <div><h2>재고 얼마 안 남은 상품</h2><p>재고가 적은 순서로 보여드려요</p></div>
            <button type="button" disabled>전체보기 <span aria-hidden="true">›</span></button>
          </div>
          <ProductRail products={lowStockProducts} />
        </section>

        <footer className="home-footer">
          <nav aria-label="푸터 링크"><span>고객센터</span><span>이용약관</span><span>개인정보처리방침</span></nav>
          <p>굿즈픽 · 팀 JJE</p>
          <p>고객센터 평일 10:00 - 18:00</p>
          <small>© 2026 굿즈픽</small>
        </footer>
      </main>

      <nav className="bottom-tabbar" aria-label="하단 메뉴">
        {[
          ['home', '홈'], ['shop', '굿즈샵'], ['category', '카테고리'], ['heart', '찜'], ['user', '마이'],
        ].map(([icon, label], index) => (
          <button className={index === 0 ? 'active' : ''} type="button" key={label} disabled aria-current={index === 0 ? 'page' : undefined}>
            <Icon name={icon} size={22} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
