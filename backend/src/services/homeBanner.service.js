// 담당: 민주
// 홈 배너 "자세히 보기" 화면(서비스 소개 · 광고 · 기획전)에 필요한 데이터
import {
  findBanner,
  findHomeProducts,
  findIntroStores,
  findProductsByCharacters,
} from '../repositories/home.repository.js';
import { formatPrice, salePrice, toCard } from './home.service.js';

// 예약금 비율 — preorders.deposit_rate 기본값과 같다.
const DEPOSIT_RATE = 20;
const LOW_STOCK_MAX = 5;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 굿즈샵 좌표가 아직 없어 목업 거리를 쓴다. 같은 매장은 항상 같은 값이 나온다.
const MOCK_DISTANCES = ['0.4km', '1.2km', '2.8km', '3.5km'];

// 12월 생일 캐릭터 목록은 아직 DB 테이블이 없어 상수로 둔다. 굿즈는 products.character_name 으로 불러온다.
const EXHIBITION_MONTH = 12;
// 캐릭터 이미지는 Supabase Storage(goods-images 버킷)에 있어 어느 주소에서든 보인다.
const CHARACTER_IMAGES = `${(process.env.SUPABASE_URL ?? '').replace(/\/(rest\/v1\/?|)$/, '')}/storage/v1/object/public/goods-images/characters/`;
const DECEMBER_BIRTHDAYS = [
  { name: '토끼', work: '토끼마을', month: 12, day: 3, imageUrl: `${CHARACTER_IMAGES}rabbit.png` },
  { name: '고죠 사토루', work: '주술회전', month: 12, day: 7, imageUrl: `${CHARACTER_IMAGES}gojo.jpg` },
  { name: '별빛소녀', work: '별빛 탐험대', month: 12, day: 15, imageUrl: `${CHARACTER_IMAGES}starlight.png` },
  { name: '루나', work: '루나퀘스트', month: 12, day: 24, imageUrl: `${CHARACTER_IMAGES}luna.png` },
];
const DEFAULT_CHARACTER = '고죠 사토루';
const GOODS_TYPES = {
  아크릴: '아크릴 스탠드',
  키링: '키링',
  포토카드: '포토카드',
  인형: '인형',
};

const notFound = (message) => Object.assign(new Error(message), { status: 404 });

const nullIfInvalidId = (error) => {
  if (error.code === '22P02') return null;
  throw error;
};

const isLiveBanner = (banner, type, now) => banner?.banner_type === type && banner.is_active
  && (!banner.starts_at || new Date(banner.starts_at) <= now)
  && (!banner.ends_at || new Date(banner.ends_at) >= now);

async function loadLiveBanner(bannerId, type) {
  const banner = await findBanner(bannerId).catch(nullIfInvalidId);
  if (!isLiveBanner(banner, type, new Date())) throw notFound('배너를 찾을 수 없습니다.');
  return banner;
}

function distanceLabel(storeId) {
  const hash = [...storeId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return MOCK_DISTANCES[hash % MOCK_DISTANCES.length];
}

function todayHours(hours, now) {
  const kstDay = new Date(now.getTime() + KST_OFFSET_MS).getUTCDay();
  const today = (hours ?? []).find((item) => item.day_of_week === kstDay);
  if (!today || today.is_closed) return null;
  return `${today.open_time.slice(0, 5)} - ${today.close_time.slice(0, 5)}`;
}

export async function getAdDetail(bannerId) {
  const banner = await loadLiveBanner(bannerId, 'AD');
  const store = banner.stores?.status === 'ACTIVE' ? banner.stores : null;
  const products = store ? await findHomeProducts() : [];

  const listings = products
    .flatMap((product) => (product.store_products ?? [])
      .filter((item) => item.store_id === store.id && item.status === 'ON_SALE')
      .map((listing) => ({ product, listing })))
    .sort((a, b) => b.listing.discount_rate - a.listing.discount_rate);

  const cards = listings.map(({ product, listing }, index) => {
    const lowStock = listing.stock > 0 && listing.stock <= LOW_STOCK_MAX;
    return {
      ...toCard(product, listing, index),
      id: listing.id,
      discountRate: listing.discount_rate,
      originalPrice: listing.discount_rate > 0 ? formatPrice(listing.price) : null,
      price: formatPrice(salePrice(listing)),
      // 재고 임박(5개 이하)은 카드 위에 빨간 라벨로 보여준다.
      stockLabel: lowStock ? `재고 ${listing.stock}개 남음` : null,
      stockText: null,
    };
  });

  return {
    id: banner.id,
    title: banner.title,
    startAt: banner.starts_at,
    endAt: banner.ends_at,
    clickCount: banner.click_count,
    store: store && {
      id: store.id,
      name: store.name,
      description: store.short_description,
      imageUrl: store.thumbnail_url,
      address: store.address,
      pickupAvailable: store.pickup_available,
      deliveryAvailable: store.delivery_available,
    },
    maxDiscountRate: Math.max(0, ...cards.map((card) => card.discountRate)),
    // 할인 중인 상품이 있으면 할인 상품만, 없으면 매장의 판매 상품을 보여준다.
    products: cards.some((card) => card.discountRate > 0)
      ? cards.filter((card) => card.discountRate > 0)
      : cards,
  };
}

export async function getServiceIntro(bannerId) {
  const banner = await loadLiveBanner(bannerId, 'SERVICE_INTRO');
  const now = new Date();
  const stores = await findIntroStores();

  return {
    id: banner.id,
    title: banner.title,
    depositRate: DEPOSIT_RATE,
    stores: stores.map((store) => ({
      id: store.id,
      name: store.name,
      address: store.address,
      imageUrl: store.thumbnail_url,
      distance: distanceLabel(store.id),
      hours: todayHours(store.store_business_hours, now),
      pickupAvailable: store.pickup_available,
      deliveryAvailable: store.delivery_available,
    })),
  };
}

function exhibitionGoodsState(listing) {
  if (listing.status === 'SOLD_OUT' || listing.status === 'UPCOMING') {
    return listing.restock_expected_at ? 'RESTOCK' : 'SOLD_OUT';
  }
  if (listing.stock <= 0) return 'SOLD_OUT';
  return listing.stock === 1 ? 'LAST_ONE' : 'IN_STOCK';
}

export async function getExhibition(bannerId, { character, type, inStock } = {}) {
  const banner = await loadLiveBanner(bannerId, 'EXHIBITION');
  // character=all 이면 12월 생일 캐릭터 전체의 굿즈를 보여준다.
  const showAll = character === 'all';
  const selected = showAll ? null : (DECEMBER_BIRTHDAYS.find((item) => item.name === character)
    ?? DECEMBER_BIRTHDAYS.find((item) => item.name === DEFAULT_CHARACTER));
  const categoryName = GOODS_TYPES[type];
  const products = await findProductsByCharacters(
    showAll ? DECEMBER_BIRTHDAYS.map((item) => item.name) : [selected.name]
  );

  const goods = products
    .filter((product) => !categoryName
      || (product.product_categories ?? []).some((item) => item.categories?.name === categoryName))
    .flatMap((product) => (product.store_products ?? [])
      .filter((item) => item.stores?.status === 'ACTIVE' && item.status !== 'HIDDEN')
      .map((listing) => ({ product, listing })))
    .map(({ product, listing }, index) => ({
      ...toCard(product, listing, index),
      id: listing.id,
      storeName: listing.stores.name,
      distance: distanceLabel(listing.store_id),
      pickupAvailable: listing.pickup_available,
      stockQuantity: listing.stock,
      stockState: exhibitionGoodsState(listing),
      restockAt: listing.restock_expected_at,
    }))
    .filter((item) => inStock !== 'true' || ['IN_STOCK', 'LAST_ONE'].includes(item.stockState));

  return {
    id: banner.id,
    title: banner.title,
    month: EXHIBITION_MONTH,
    characters: DECEMBER_BIRTHDAYS,
    selected,
    goodsTypes: Object.keys(GOODS_TYPES),
    goods,
  };
}
