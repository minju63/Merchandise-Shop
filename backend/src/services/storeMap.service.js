import { storeMapRepository } from '../repositories/storeMap.repository.js';
import { businessStatus } from './storeBusinessHours.service.js';
import { supabase } from '../lib/supabase.js';

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
      distanceKm: distance, popularity: Number(s.view_count) || 0 }];
  });
  // Count sellers before location and UI filters so an empty viewport is not
  // mistaken for a product that has no sellers anywhere.
  const sellerCount = productId
    ? new Set(listings.filter((l) => l.product_id === productId && activeStores.has(l.store_id)).map((l) => l.store_id)).size
    : activeStores.size;
  const inStockCount = items.filter((s) => s.inStock).length;
  items.sort((a, b) => (sort === 'stock' ? (b.inStock ? b.stock || 0 : 0) - (a.inStock ? a.stock || 0 : 0)
    : sort === 'distance' ? a.distanceKm - b.distanceKm : b.popularity - a.popularity) || a.id.localeCompare(b.id));
  return { items, totalCount: items.length, sellerCount, inStockCount, noCoordinateCount,
    products: suggestions.map((p) => ({ id: p.id, name: p.name, workTitle: p.work_title, characterName: p.character_name, thumbnailUrl: image(p.thumbnail_url) })),
    regions: data.regions, product: productId && products.has(productId)
      ? { ...products.get(productId), thumbnailUrl: image(products.get(productId).thumbnail_url) } : null };
}

export async function getMapStores(options) {
  return buildMapResult(await storeMapRepository.load(options.productId), options);
}
