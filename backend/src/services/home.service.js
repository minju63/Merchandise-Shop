// 담당: 민주
// 홈 서비스 — 비즈니스 로직, DB 접근은 repositories/ 를 통해서만
import { findActiveCategories, findHomeBanners, findHomeProducts } from '../repositories/home.repository.js';

const SECTION_LIMIT = 10;
const RECOMMENDATION_LIMIT = 30;
const LOW_STOCK_MAX = 10;
const ACCENTS = ['#eee8ff', '#ffe9ee', '#e3f2fa', '#fff2cf', '#e5f4ed', '#f1e8ff', '#e4f3fb'];

export const formatPrice = (price) => `${price.toLocaleString('ko-KR')}원`;
export const salePrice = ({ price, discount_rate: discountRate }) => Math.round(price * (100 - discountRate) / 100);
// CONTENT_IDOL → idol, GOODS_PHOTOCARD → photocard (프런트 관심 카테고리 id)
// categories.is_home_shortcut 으로 지정한 카테고리가 없으면 아래 4개를 홈 바로가기로 쓴다.
const HOME_SHORTCUT_LIMIT = 4;
const DEFAULT_SHORTCUT_CODES = ['CONTENT_IDOL', 'CONTENT_ANIMATION', 'GOODS_PHOTOCARD', 'GOODS_KEYRING'];
const SHORTCUT_ICONS = { idol: 'mic', animation: 'play', photocard: 'card', keyring: 'link' };

const categorySlug = (code) => code.replace(/^(CONTENT|GOODS)_/, '').toLowerCase();

export function representativeListing(product) {
  const listings = (product.store_products ?? []).filter((item) => item.stores?.status === 'ACTIVE');
  const onSale = listings
    .filter((item) => item.status === 'ON_SALE' && item.stock > 0)
    .sort((a, b) => salePrice(a) - salePrice(b));
  return onSale[0] ?? listings.find((item) => item.status === 'UPCOMING') ?? null;
}

function goodsCategoryName(product) {
  const categories = (product.product_categories ?? []).map((item) => item.categories).filter(Boolean);
  return (categories.find((item) => item.type === 'GOODS') ?? categories[0])?.name ?? '굿즈';
}

function shippingLabel(listing) {
  if (listing.pickup_available && listing.delivery_available) return '픽업·배송';
  return listing.pickup_available ? '픽업' : '배송';
}

export function toCard(product, listing, index) {
  const stock = listing?.stock ?? 0;
  const isScarce = stock > 0 && stock <= LOW_STOCK_MAX;
  return {
    id: product.id,
    storeProductId: listing?.id ?? null,
    category: goodsCategoryName(product),
    shop: listing?.stores?.name ?? '',
    name: product.name,
    imageUrl: product.thumbnail_url,
    price: formatPrice(listing ? salePrice(listing) : product.base_price),
    stockText: stock > 0 ? (isScarce ? `재고 ${stock}개` : '재고 있음') : null,
    stockTone: isScarce ? 'danger' : undefined,
    shipping: listing ? shippingLabel(listing) : null,
    accent: ACCENTS[index % ACCENTS.length],
  };
}

function buildCategoryShortcuts(categories) {
  const flagged = categories.filter((category) => category.is_home_shortcut);
  const picked = (flagged.length
    ? flagged
    : DEFAULT_SHORTCUT_CODES.map((code) => categories.find((category) => category.code === code)).filter(Boolean)
  ).slice(0, HOME_SHORTCUT_LIMIT);

  const shortcuts = picked.map((category, index) => {
    const id = categorySlug(category.code);
    return {
      id,
      categoryId: category.id,
      type: category.type,
      name: category.name,
      icon: SHORTCUT_ICONS[id] ?? 'grid',
      isHomeShortcut: true,
      sortOrder: index + 1,
    };
  });

  // "전체"는 DB 카테고리가 아니라 카테고리 탭으로 가는 고정 바로가기라 항상 마지막에 둔다.
  return [...shortcuts, {
    id: 'all',
    categoryId: null,
    type: 'ALL',
    name: '전체',
    icon: 'grid',
    isHomeShortcut: true,
    sortOrder: shortcuts.length + 1,
  }];
}

// 관심사 설정에서 고를 수 있는 카테고리 전체. id 는 상품의 interestCategoryIds 와 같은 값이다.
function buildInterestCategories(categories) {
  return [...categories]
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ko') : a.type === 'CONTENT' ? -1 : 1))
    .map((category) => ({ id: categorySlug(category.code), name: category.name, type: category.type }));
}

function buildBanners(rows) {
  return rows.map((banner) => ({
    id: banner.id,
    bannerType: banner.banner_type,
    title: banner.title,
    imageUrl: banner.image_url || null,
    advertiserName: banner.banner_type === 'AD' ? (banner.stores?.name ?? null) : null,
    // 팬 응원 전광판(FAN)에만 쓰는 값
    characterName: banner.character_name,
    eventDate: banner.event_date,
    message: banner.message,
    fanNickname: banner.fan_nickname,
    startAt: banner.starts_at ?? '1970-01-01T00:00:00Z',
    endAt: banner.ends_at ?? '9999-12-31T23:59:59Z',
    clickCount: banner.click_count,
  }));
}

function buildUpcoming(products, now) {
  const items = [];

  products
    .filter((product) => product.status === 'UPCOMING' && product.open_at)
    .forEach((product, index) => {
      items.push({
        ...toCard(product, representativeListing(product), index),
        status: 'UPCOMING',
        openType: 'NEW',
        openAt: product.open_at,
        alertCount: product.alert_count,
        stockText: null,
        shipping: null,
      });
    });

  // 품절 후 재입고 시각이 정해진 상품
  products.forEach((product, index) => {
    (product.store_products ?? [])
      .filter((item) => item.status === 'SOLD_OUT' && item.restock_expected_at && new Date(item.restock_expected_at) > now)
      .forEach((listing) => {
        items.push({
          ...toCard(product, listing, index),
          id: listing.id,
          status: 'UPCOMING',
          openType: 'RESTOCK',
          openAt: listing.restock_expected_at,
          alertCount: product.alert_count,
          stockText: null,
          shipping: null,
        });
      });
  });

  return items.sort((a, b) => new Date(a.openAt) - new Date(b.openAt) || b.alertCount - a.alertCount);
}

export async function getHome() {
  const now = new Date();
  const [bannerRows, products, categories] = await Promise.all([
    findHomeBanners(now.toISOString()),
    findHomeProducts(),
    findActiveCategories(),
  ]);

  const onSale = products
    .filter((product) => product.status === 'ON_SALE')
    .map((product) => ({ product, listing: representativeListing(product) }))
    .filter(({ listing }) => listing);

  const popularProducts = [...onSale]
    .sort((a, b) => b.product.popularity_score - a.product.popularity_score)
    .slice(0, SECTION_LIMIT)
    .map(({ product, listing }, index) => ({
      ...toCard(product, listing, index),
      popularityScore: Number(product.popularity_score),
    }));

  const newProducts = [...onSale]
    .sort((a, b) => new Date(b.product.released_at ?? b.product.created_at) - new Date(a.product.released_at ?? a.product.created_at))
    .slice(0, SECTION_LIMIT)
    .map(({ product, listing }, index) => ({
      ...toCard(product, listing, index),
      releasedAt: product.released_at ?? product.created_at,
      isNew: true,
    }));

  const recommendationProducts = [...onSale]
    .sort((a, b) => b.product.popularity_score - a.product.popularity_score)
    .slice(0, RECOMMENDATION_LIMIT)
    .map(({ product, listing }, index) => ({
      ...toCard(product, listing, index),
      popularityScore: Number(product.popularity_score),
      brand: product.brand ?? null,
      interestCategoryIds: (product.product_categories ?? [])
        .map((item) => item.categories && categorySlug(item.categories.code))
        .filter(Boolean),
    }));

  // 재고는 굿즈샵별 판매 상품(store_products) 기준이라 같은 상품도 샵마다 따로 나온다.
  const lowStockProducts = products
    .flatMap((product) => (product.store_products ?? [])
      .filter((item) => item.status === 'ON_SALE' && item.stores?.status === 'ACTIVE'
        && item.stock >= 1 && item.stock <= LOW_STOCK_MAX)
      .map((listing) => ({ product, listing })))
    .sort((a, b) => a.listing.stock - b.listing.stock)
    .slice(0, SECTION_LIMIT)
    .map(({ product, listing }, index) => ({
      ...toCard(product, listing, index),
      id: listing.id,
      stockQuantity: listing.stock,
      stockLabel: `재고 ${listing.stock}개 남음`,
      stockText: null,
    }));

  return {
    banners: buildBanners(bannerRows),
    categories: buildCategoryShortcuts(categories),
    interestCategories: buildInterestCategories(categories),
    popularProducts,
    newProducts,
    recommendationProducts,
    upcomingProducts: buildUpcoming(products, now).slice(0, SECTION_LIMIT),
    lowStockProducts,
  };
}
