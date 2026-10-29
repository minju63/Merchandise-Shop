import { useEffect, useRef, useState } from 'react';
import ProductCard from '../../components/ProductCard.jsx';
import UpcomingProductCard from '../../components/UpcomingProductCard.jsx';
import Icon from '../../components/Icon.jsx';
import PromoBanner from './PromoBanner.jsx';
import { brandGroupFor, hasPickedBrands, matchesInterests } from './interestMatch.js';
import BottomNavigation from '../../components/BottomNavigation.jsx';
import './HomePage.css';

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
  };

  const handlePointerMove = (event) => {
    if (!dragState.current.active) return;
    const distance = event.clientX - dragState.current.startX;
    if (!dragState.current.moved && Math.abs(distance) > 3) {
      // 포인터를 미리 붙잡으면 클릭이 카드가 아닌 목록으로 가서, 실제로 드래그할 때만 붙잡는다.
      dragState.current.moved = true;
      event.currentTarget.classList.add('is-dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (dragState.current.moved) {
      event.currentTarget.scrollLeft = dragState.current.scrollLeft - distance;
    }
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
          onClick={onProductClick && product.storeProductId ? () => onProductClick(product) : undefined}
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
  interestBrands = [],
  onOpenInterestSettings,
  onOpenProduct,
  onOpenCategory,
  onOpenTrending,
  onOpenUpcoming,
  onOpenLowStock,
  onOpenCart,
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
    (data.interestCategories ?? data.categories).find((category) => category.id === categoryId)
  )).filter(Boolean);
  const personalizedRecommendations = (data.recommendationProducts ?? [])
    .filter((product) => matchesInterests(product, activeInterestCategoryIds, interestBrands));
  // 선택한 관심 카테고리 안에 속한 브랜드만 칩으로 보여준다
  const visibleInterestBrands = interestBrands.filter((name) => activeInterestCategoryIds.some((id) => (
    brandGroupFor(id)?.brands.some((brand) => brand.name === name)
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
    onNavigate({ bannerId: activeBanner.id, bannerType: activeBanner.bannerType });
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
            <button type="button" aria-label="알림 목록 화면 준비 중" disabled>
              <Icon name="bell" size={21} />
              {data.badges.notifications > 0 && <span className="action-badge">{data.badges.notifications}</span>}
            </button>
            <button type="button" aria-label="장바구니" onClick={onOpenCart} disabled={!onOpenCart}>
              <Icon name="cart" size={22} />
              {data.badges.cart > 0 && <span className="action-badge">{data.badges.cart}</span>}
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
            <PromoBanner
              key={activeBanner.id}
              banner={activeBanner}
              position={`${normalizedBannerIndex + 1} / ${visibleBanners.length}`}
              dragProps={{
                onPointerDown: handleBannerPointerDown,
                onPointerMove: handleBannerPointerMove,
                onPointerUp: handleBannerPointerUp,
                onPointerCancel: resetBannerDrag,
                onClickCapture: handleBannerClickCapture,
              }}
              onOpen={onNavigate && activeBanner.bannerType !== 'FAN' ? handleBannerAction : undefined}
            />
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
            <button
              type="button"
              key={category.id}
              onClick={() => onOpenCategory?.(category)}
              disabled={!onOpenCategory}
            >
              <span className="category-shortcuts__icon"><Icon name={category.icon} size={22} /></span>
              <span>{category.name}</span>
            </button>
          ))}
        </nav>

        <section className="home-section trending-section">
          <div className="home-section-heading">
            <div><h2>지금 뜨는 굿즈</h2><p>요즘 가장 주목받는 상품이에요</p></div>
            <button
              type="button"
              onClick={() => onOpenTrending?.(activeProductTab)}
              disabled={!onOpenTrending}
            >전체보기 <span aria-hidden="true">›</span></button>
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
          <ProductRail
            products={activeProducts}
            ranked={activeProductTab === 'popular'}
            onProductClick={onOpenProduct}
          />
        </section>

        <section className="home-section recommendation-section">
          {isAuthenticated && hasInterests ? (
            <>
              <div className="home-section-heading">
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
                {/* 브랜드를 고른 분류는 분류 이름 대신 고른 브랜드만 칩으로 보여준다 */}
                {activeInterestCategories.filter((category) => !hasPickedBrands(category.id, interestBrands)).map((category) => (
                  <span className="active" key={category.id}>{category.name}</span>
                ))}
                {visibleInterestBrands.map((name) => (
                  <span className="active" key={name}>{name}</span>
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
          <div className="home-section-heading">
            <div>
              <h2>입고 예정 상품</h2>
              <p>오픈 시각이 가까운 순 · 알림 받고 놓치지 마세요</p>
            </div>
            <button type="button" onClick={onOpenUpcoming} disabled={!onOpenUpcoming}>
              전체보기 <span aria-hidden="true">›</span>
            </button>
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
                onClick={onOpenProduct && product.storeProductId ? () => onOpenProduct(product) : undefined}
              />
            ))}
          </HorizontalRail>
        </section>

        <section className="home-section">
          <div className="home-section-heading">
            <div><h2>품절 임박 상품</h2><p>재고가 적은 순서로 보여드려요</p></div>
            <button type="button" onClick={onOpenLowStock} disabled={!onOpenLowStock}>
              전체보기 <span aria-hidden="true">›</span>
            </button>
          </div>
          <ProductRail products={lowStockProducts} onProductClick={onOpenProduct} />
        </section>

        <footer className="home-footer">
          <nav aria-label="푸터 링크"><span>고객센터</span><span>이용약관</span><span>개인정보처리방침</span></nav>
          <p>굿즈픽 · 팀 JJE</p>
          <p>고객센터 평일 10:00 - 18:00</p>
          <small>© 2026 굿즈픽</small>
        </footer>
      </main>

      <BottomNavigation />
    </div>
  );
}
