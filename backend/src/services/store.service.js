import { listActiveStores, getActiveStore } from '../repositories/store.repository.js';
import { getStoreImages } from '../repositories/storeImage.repository.js';
import { getStoreBusinessHours } from '../repositories/storeBusinessHour.repository.js';
import { getStoreCategories } from '../repositories/storeCategory.repository.js';
import { getStorePickupInfos } from '../repositories/storePickupInfo.repository.js';
import { getStoreDeliveryInfos } from '../repositories/storeDeliveryInfo.repository.js';
import { getStoreDeliveryAreas } from '../repositories/storeDeliveryArea.repository.js';
import { getStoreProducts } from '../repositories/storeProduct.repository.js';
import { getProducts } from '../repositories/product.repository.js';
import { getProductImages } from '../repositories/productImage.repository.js';
import { getRegions } from '../repositories/region.repository.js';
import { supabase } from '../lib/supabase.js';
import { businessStatus } from './storeBusinessHours.service.js';
import { getReviewSummary, getReviewSummaries } from '../repositories/review.repository.js';

// '재고 많은 순'은 판매 중이며 재고가 1개 이상인 상품 수를 기준으로 한다.
export const STOCK_SORT_COUNTS_SELLABLE_PRODUCTS = true;

function truthy(value) {
  return value === true || value === 'true' || value === 'Y' || value === 1;
}

function publicImage(value, bucket) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const path = value.replace(new RegExp(`^${bucket}/`), '');
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function group(rows, key = 'store_id') {
  const result = new Map();
  for (const row of rows) result.set(row[key], [...(result.get(row[key]) || []), row]);
  return result;
}

function addressRegion(address) {
  const parts = String(address || '').split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || '';
}

function sellable(row) {
  return !['HIDDEN', 'INACTIVE', 'DELETED'].includes(row.status);
}

function compareNumbers(a, b) {
  return Number(b || 0) - Number(a || 0);
}

async function related(storeIds, { full = false } = {}) {
  const [images, hours, categoryData, pickups, deliveries, storeProducts, areas] =
    await Promise.all([
      getStoreImages(storeIds),
      getStoreBusinessHours(storeIds),
      getStoreCategories(storeIds),
      getStorePickupInfos(storeIds),
      getStoreDeliveryInfos(storeIds),
      getStoreProducts(storeIds),
      full ? getStoreDeliveryAreas(storeIds) : Promise.resolve([]),
    ]);
  return {
    images: group(images),
    hours: group(hours),
    categoryLinks: group(categoryData.links),
    categories: new Map(categoryData.categories.map((row) => [row.id, row])),
    pickups: group(pickups),
    deliveries: group(deliveries),
    storeProducts: group(storeProducts),
    areas: group(areas),
  };
}

function mapStore(store, data, regions = new Map()) {
  const id = store.id;
  const hours = data.hours.get(id) || [];
  const pickupInfo = data.pickups.get(id)?.[0] || null;
  const deliveryInfo = data.deliveries.get(id)?.[0] || null;
  const listings = (data.storeProducts.get(id) || []).filter(sellable);
  const inStock = listings.filter((row) => row.status === 'ON_SALE' && Number(row.stock) > 0);
  const imageRows = (data.images.get(id) || []).toSorted(
    (a, b) =>
      Number(a.sort_order ?? a.display_order ?? 0) - Number(b.sort_order ?? b.display_order ?? 0)
  );
  const images = [
    ...new Set(
      [store.thumbnail_url, ...imageRows.map((row) => row.image_url)]
        .map((value) => publicImage(value, 'goods-images'))
        .filter(Boolean)
    ),
  ];
  const status = businessStatus(hours, truthy(store.temporary_closed), undefined, store.status);
  const categoryNames = (data.categoryLinks.get(id) || [])
    .map((link) => data.categories.get(link.category_id)?.name)
    .filter(Boolean);
  const pickupAvailable = truthy(store.pickup_available);
  const deliveryAvailable = truthy(store.delivery_available);
  return {
    id,
    name: store.name,
    shortDescription: store.short_description ?? '',
    description: store.description ?? '',
    address: store.address ?? '',
    phone: store.phone ?? '',
    latitude: store.latitude ?? null,
    longitude: store.longitude ?? null,
    region: regions.get(store.region_id)?.name || addressRegion(store.address),
    regionId: store.region_id ?? null,
    categoryNames,
    images,
    rating: Number(store.rating_avg ?? 0),
    reviewCount: Number(store.review_count ?? 0),
    availableProductCount: inStock.length,
    openNow: status.openNow,
    businessStatus: status.status,
    openReason: status.reason,
    todayHours: status.todayHours,
    todayDay: status.todayDay,
    pickupAvailable,
    deliveryAvailable,
    temporaryClosed: truthy(store.temporary_closed),
    viewCount: Number(store.view_count || 0),
    createdAt: store.created_at,
    businessHours: hours,
    pickupInfo,
    deliveryInfo,
    deliveryAreas: (data.areas.get(id) || []).map((row) => ({
      ...row,
      regionName: regions.get(row.region_id)?.name ?? '',
    })),
  };
}

function paginate(items, { page, size }) {
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    size,
    totalCount: items.length,
  };
}

export async function listStores({ openNow, pickup, delivery, sort, page, size }) {
  const stores = await listActiveStores();
  const [data, regionRows] = await Promise.all([
    related(stores.map((row) => row.id)),
    getRegions([...new Set(stores.map((row) => row.region_id).filter(Boolean))]),
  ]);
  const regions = new Map(regionRows.map((row) => [row.id, row]));
  let items = stores.map((row) => mapStore(row, data, regions));
  if (openNow) items = items.filter((row) => row.openNow);
  if (pickup) items = items.filter((row) => row.pickupAvailable);
  if (delivery) items = items.filter((row) => row.deliveryAvailable);
  const allStoresCount = stores.length;
  items.sort(
    (a, b) =>
      (sort === 'newest'
        ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        : sort === 'stock'
          ? compareNumbers(a.availableProductCount, b.availableProductCount)
          : compareNumbers(a.viewCount, b.viewCount)) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')) ||
      a.id.localeCompare(b.id)
  );
  const result = paginate(items, { page, size });
  const summaries = await getReviewSummaries(result.items.map((item) => item.id));
  return { ...result, items: result.items.map((item) => ({ ...item, ...summaries.get(item.id) })), allStoresCount };
}

export async function getStoreDetail(storeId) {
  const store = await getActiveStore(storeId);
  if (!store) return null;
  const [data, summary] = await Promise.all([related([storeId], { full: true }), getReviewSummary(storeId)]);
  const regionRows = await getRegions([
    ...new Set(
      [store.region_id, ...(data.areas.get(storeId) || []).map((row) => row.region_id)].filter(
        Boolean
      )
    ),
  ]);
  return { ...mapStore(store, data, new Map(regionRows.map((row) => [row.id, row]))), ...summary };
}

export async function getStoreProductsPage(storeId, { sort, page, size }) {
  const store = await getActiveStore(storeId);
  if (!store) return null;
  const listings = (await getStoreProducts([storeId])).filter(sellable);
  const products = await getProducts([
    ...new Set(listings.map((row) => row.product_id).filter(Boolean)),
  ]);
  const images = await getProductImages(products.map((row) => row.id));
  const imagesByProduct = group(images, 'product_id');
  const productMap = new Map(products.map((row) => [row.id, row]));
  let items = listings
    .map((listing) => {
      const product = productMap.get(listing.product_id);
      if (!product || ['DISCONTINUED', 'HIDDEN', 'INACTIVE', 'DELETED'].includes(product.status))
        return null;
      const stock = listing.stock == null ? null : Number(listing.stock);
      const onSale = listing.status === 'ON_SALE' && product.status === 'ON_SALE';
      const image =
        product.thumbnail_url ||
        (imagesByProduct.get(product.id) || []).toSorted(
          (a, b) => Number(a.display_order) - Number(b.display_order)
        )[0]?.image_url;
      const stockLabel = !onSale
        ? listing.status === 'UPCOMING' || product.status === 'UPCOMING'
          ? '판매 예정'
          : listing.status === 'SOLD_OUT'
            ? listing.restock_expected_at
              ? '품절 · 입고 예정'
              : '품절'
            : '판매 중지'
        : stock === null
          ? '재고 확인 불가'
          : stock >= 4
            ? '재고 있음'
            : stock > 0
              ? `품절 임박 · ${stock}개`
              : listing.restock_expected_at
                ? '품절 · 입고 예정'
                : '품절';
      return {
        storeProductId: listing.id,
        productId: product.id,
        name: product.name,
        image: publicImage(image, 'goods-images'),
        price: listing.price == null ? null : Number(listing.price),
        stock,
        stockLabel,
        purchasable: onSale && stock > 0 && listing.price != null,
        pickupAvailable: Boolean(store.pickup_available && listing.pickup_available),
        deliveryAvailable: Boolean(store.delivery_available && listing.delivery_available),
        popularityScore: Number(product.popularity_score || 0),
        salesCount: Number(listing.sales_count || 0),
        createdAt: listing.created_at,
      };
    })
    .filter(Boolean);
  items.sort(
    (a, b) =>
      (sort === 'sales'
        ? compareNumbers(a.salesCount, b.salesCount)
        : sort === 'newest'
          ? String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          : sort === 'stock'
            ? compareNumbers(a.stock, b.stock)
            : compareNumbers(a.popularityScore, b.popularityScore)) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')) ||
      a.storeProductId.localeCompare(b.storeProductId)
  );
  return {
    ...paginate(items, { page, size }),
    purchasableCount: items.filter((item) => item.purchasable).length,
  };
}
