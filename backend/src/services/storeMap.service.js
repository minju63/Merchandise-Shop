import { storeMapRepository } from '../repositories/storeMap.repository.js';
import { businessStatus } from './storeBusinessHours.service.js';
import { supabase } from '../lib/supabase.js';
import { matchesRegionName } from '../utils/regionNames.js';
import { DISTRICTS } from '../../../shared/districts.js';
import { geocodeKeyword } from './geocode.service.js';

const normalize = (value) => String(value ?? '').toLocaleLowerCase().replace(/\s+/g, '');
const matches = (values, keyword) => normalize(values.join(' ')).includes(normalize(keyword));
const enabled = (value) => value === true;
const image = (path) => !path ? null : /^https?:\/\//i.test(path) ? path
  : supabase.storage.from('goods-images').getPublicUrl(path.replace(/^goods-images\//, '')).data.publicUrl;

export function distanceKm(a, b) {
  const rad = (v) => v * Math.PI / 180;
  const x = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, x)));
}

export function buildMapResult(data, options = {}) {
  const { keyword = '', productId, regionId, openNow, pickup, delivery, inStock, origin, radius, bounds, sort = 'popular' } = options;
  const regions = new Map(data.regions.map((r) => [r.id, r.name]));
  const districts = DISTRICTS[options.region] || [];
  const products = new Map(data.products.filter((p) => ['ON_SALE', 'SOLD_OUT'].includes(p.status)).map((p) => [p.id, p]));
  const listings = data.listings.filter((l) => ['ON_SALE', 'SOLD_OUT'].includes(l.status) && products.has(l.product_id));
  const activeStores = new Set(data.stores.filter((s) => s.status === 'ACTIVE').map((s) => s.id));
  const listedProducts = new Set(listings.filter((l) => activeStores.has(l.store_id)).map((l) => l.product_id));
  const byStore = new Map();
  const hoursByStore = new Map();
  for (const l of listings) { if (!byStore.has(l.store_id)) byStore.set(l.store_id, []); byStore.get(l.store_id).push(l); }
  for (const h of data.hours) { if (!hoursByStore.has(h.store_id)) hoursByStore.set(h.store_id, []); hoursByStore.get(h.store_id).push(h); }
  const suggestions = [...products.values()].filter((p) => matches([p.name, p.work_title, p.character_name], keyword)
    && listedProducts.has(p.id));
  let noCoordinateCount = 0;
  let items = data.stores.filter((s) => s.status === 'ACTIVE').flatMap((s) => {
    const owned = byStore.get(s.id) || [];
    const listing = productId ? owned.find((l) => l.product_id === productId) : null;
    if (productId && !listing) return [];
    if (regionId && s.region_id !== regionId) return [];
    if (options.region && !matchesRegionName(s.address || regions.get(s.region_id), [options.region])) return [];
    if (options.district) {
      const addressParts = String(s.address || '').trim().split(/\s+/).slice(1);
      const selectedParts = options.district.split(/\s+/);
      if (!selectedParts.every((part, index) => addressParts[index] === part)) return [];
    }
    if (keyword && !matches([s.name, s.address, regions.get(s.region_id)], keyword)
      && !owned.some((l) => { const p = products.get(l.product_id); return matches([p.name, p.work_title, p.character_name], keyword); })) return [];
    const open = businessStatus(hoursByStore.get(s.id) || [], s.temporary_closed === true, undefined, s.status).openNow;
    const pickupAvailable = enabled(s.pickup_available) && (!listing || enabled(listing.pickup_available));
    const deliveryAvailable = enabled(s.delivery_available) && (!listing || enabled(listing.delivery_available));
    const stock = listing ? Math.max(0, Number(listing.stock) || 0) : null;
    const available = listing ? listing.status === 'ON_SALE' && products.get(listing.product_id).status === 'ON_SALE' && stock > 0 : owned.some((l) => l.status === 'ON_SALE' && products.get(l.product_id).status === 'ON_SALE' && Number(l.stock) > 0);
    if ((openNow && !open) || (pickup && !pickupAvailable) || (delivery && !deliveryAvailable) || (inStock && !available)) return [];
    if (s.latitude == null || s.longitude == null || s.latitude === '' || s.longitude === '') { noCoordinateCount++; return []; }
    const latitude = Number(s.latitude), longitude = Number(s.longitude);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) { noCoordinateCount++; return []; }
    const distance = origin ? distanceKm(origin, { latitude, longitude }) : null;
    if (radius && distance > radius) return [];
    if (bounds && (latitude < bounds.south || latitude > bounds.north || longitude < bounds.west || longitude > bounds.east)) return [];
    return [{ id: s.id, storeId: s.id, name: s.name, storeName: s.name, address: s.address,
      region: regions.get(s.region_id) || '', latitude, longitude, thumbnailUrl: image(s.thumbnail_url),
      stock, status: listing ? (available ? 'ON_SALE' : 'SOLD_OUT') : null, inStock: available,
      storeProductId: listing?.id ?? null, pickupAvailable, deliveryAvailable, openNow: open,
      distanceKm: distance, popularity: Number(s.view_count) || 0, createdAt: s.created_at ?? null }];
  });
  // Count sellers before location and UI filters so an empty viewport is not
  // mistaken for a product that has no sellers anywhere.
  const sellerCount = productId
    ? new Set(listings.filter((l) => l.product_id === productId && activeStores.has(l.store_id)).map((l) => l.store_id)).size
    : activeStores.size;
  const inStockCount = items.filter((s) => s.inStock).length;
  items.sort((a, b) => (sort === 'stock' ? (b.inStock ? b.stock || 0 : 0) - (a.inStock ? a.stock || 0 : 0)
    : sort === 'distance' ? a.distanceKm - b.distanceKm
      : sort === 'newest' ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        : b.popularity - a.popularity) || a.id.localeCompare(b.id));
  return { items, totalCount: items.length, sellerCount, inStockCount, noCoordinateCount,
    products: suggestions.map((p) => ({ id: p.id, name: p.name, workTitle: p.work_title, characterName: p.character_name, thumbnailUrl: image(p.thumbnail_url) })),
    regions: data.regions, districts, product: productId && products.has(productId)
      ? { ...products.get(productId), thumbnailUrl: image(products.get(productId).thumbnail_url) } : null };
}

const AREA_RADIUS_KM = 3;

export async function getMapStores(options) {
  const data = await storeMapRepository.load(options.productId);
  const result = buildMapResult(data, options);
  // 이름·주소·상품으로 못 찾은 검색어는 장소 이름으로 보고, 그 좌표 주변 매장을 보여준다.
  if (!options.keyword || options.productId || result.items.length) return result;
  const place = await geocodeKeyword(options.keyword);
  if (!place) return result;
  const nearby = buildMapResult(data, { ...options, keyword: '', origin: place, radius: AREA_RADIUS_KM, sort: 'distance' });
  // 키워드 없이 다시 만든 결과라 상품 후보가 전부 딸려 오므로 비운다.
  return { ...nearby, products: [], area: { ...place, radius: AREA_RADIUS_KM } };
}

// 통합 검색용: 장소 이름의 좌표 주변(AREA_RADIUS_KM) 매장 id 목록
export async function getAreaStoreIds(keyword) {
  const place = await geocodeKeyword(keyword);
  if (!place) return null;
  const data = await storeMapRepository.load();
  const storeIds = data.stores
    .filter((s) => s.status === 'ACTIVE' && s.latitude != null && s.longitude != null
      && distanceKm(place, { latitude: s.latitude, longitude: s.longitude }) <= AREA_RADIUS_KM)
    .map((s) => s.id);
  return { name: place.name, radius: AREA_RADIUS_KM, storeIds };
}
