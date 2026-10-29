import * as productCategoryRepository from '../repositories/productCategory.repository.js';
import * as productImageRepository from '../repositories/productImage.repository.js';
import * as productEngagementRepository from '../repositories/productEngagement.repository.js';

function failure(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

function requireMethod(repository, name) {
  if (typeof repository?.[name] !== 'function') {
    throw failure(`Repository의 ${name} 구현이 필요합니다.`, 503, 'DEPENDENCY_NOT_READY');
  }
}

export function calculateDisplayStatus({ status, stock }) {
  if (status === 'ON_SALE') return stock > 0 ? 'ON_SALE' : 'SOLD_OUT';
  if (['SOLD_OUT', 'UPCOMING', 'HIDDEN', 'DELETED'].includes(status)) return status;
  throw failure('알 수 없는 판매 상태입니다.', 500, 'INVALID_PRODUCT_STATUS');
}

// Store Repository supplies is_operating as a boolean; unknown state cannot permit purchase.
export function validateProductAvailability(storeProduct, store) {
  if (!storeProduct || !store || ['HIDDEN', 'DELETED'].includes(storeProduct.status)) {
    throw failure('상품을 찾을 수 없습니다.', 404, 'PRODUCT_NOT_FOUND');
  }
  const displayStatus = calculateDisplayStatus(storeProduct);
  const storeOperating = store.is_operating === true;
  return {
    displayStatus,
    storeOperating,
    canPurchase: storeOperating && displayStatus === 'ON_SALE',
    unavailableReason: !storeOperating
      ? 'STORE_NOT_OPERATING'
      : displayStatus === 'SOLD_OUT'
        ? 'SOLD_OUT'
        : displayStatus === 'UPCOMING'
          ? 'UPCOMING'
          : null,
  };
}

/* Shared Repository integration contract (request these methods from their owners):
 * storeProduct.findPage(filters) -> { items, totalCount }
 *   Each item is a store_products row with product and store objects joined.
 *   Apply all filters BEFORE count/pagination: productIds, relatedProductIds,
 *   excludeStoreProductId, regionId, min/maxPrice, inStock, pickup, delivery.
 *   Always exclude HIDDEN/DELETED. inStock means ON_SALE AND stock > 0.
 *   pickup/delivery mean BOTH store and listing flags; false filters for unavailable.
 *   regionId excludes stores without a region. Sort popular/newest by product fields,
 *   price sorts by listing price; use listing id as a stable tie breaker.
 * storeProduct.findById(id), product.findById(id), store.findById(id) -> row | null.
 * store.findById includes region. Stores expose is_operating, pickup_available,
 * delivery_available. Products expose name, thumbnail_url, description, spec.
 * wishlist.findStoreProductIds({ userId, storeProductIds }) -> string[].
 * Category-owned Repository contracts:
 * productCategory.findProductIdsByCategories({ contentCategoryId, goodsCategoryId })
 *   -> string[] using intersection when both category filters are supplied.
 * productCategory.findByProductId(productId) -> [{ category_id, category: { id, type, name } }].
 * productCategory.findRelatedProductIds({ productId, categoryIds }) -> string[],
 *   matching any category, excluding the source product, with no duplicate IDs.
 * productImage.findByProductId(productId) -> ordered image rows.
 */
export function createProductService(repositories) {
  const { storeProduct, product, store, productCategory, productImage, wishlist, engagement } = repositories;

  async function wishlistedIds(userId, items) {
    if (!userId || items.length === 0) return new Set();
    requireMethod(wishlist, 'findStoreProductIds');
    return new Set(
      await wishlist.findStoreProductIds({
        userId,
        storeProductIds: items.map((item) => item.id),
      })
    );
  }

  function card(listing, wished) {
    const availability = validateProductAvailability(listing, listing.store);
    if (!listing.product) throw failure('상품 공통 정보가 없습니다.', 404, 'PRODUCT_NOT_FOUND');
    return {
      storeProductId: listing.id,
      productId: listing.product_id,
      productName: listing.product.name,
      name: listing.product.name,
      thumbnailUrl: listing.product.thumbnail_url ?? null,
      price: listing.price,
      discountRate: listing.discount_rate ?? 0,
      stock: listing.stock,
      status: listing.status,
      ...availability,
      // 출시 예정은 오픈 시각, 품절 상품은 재입고일이 남아 있을 때만 입고 예정 시각을 내려준다.
      upcomingAt: listing.status === 'UPCOMING'
        ? (listing.product.open_at ?? null)
        : ((availability.displayStatus === 'SOLD_OUT') && listing.restock_expected_at
          && new Date(listing.restock_expected_at) > new Date() ? listing.restock_expected_at : null),
      storeId: listing.store.id,
      storeName: listing.store.name,
      pickupAvailable:
        availability.storeOperating &&
        listing.pickup_available === true &&
        listing.store.pickup_available === true,
      deliveryAvailable:
        availability.storeOperating &&
        listing.delivery_available === true &&
        listing.store.delivery_available === true,
      isWishlisted: wished.has(listing.id),
    };
  }

  async function pageResult(filters, userId) {
    requireMethod(storeProduct, 'findPage');
    const { items, totalCount } = await storeProduct.findPage(filters);
    const wished = await wishlistedIds(userId, items);
    return {
      items: items.map((item) => card(item, wished)),
      page: filters.page,
      size: filters.size,
      totalCount,
    };
  }

  async function engagementPageResult(filters, userId) {
    requireMethod(storeProduct, 'findPage');
    if (filters.ratingMin !== undefined) requireMethod(engagement, 'findRatingAverages');
    if (filters.wishlistMin !== undefined) requireMethod(engagement, 'findWishlistCounts');

    const candidates = [];
    for (let page = 1; ; page += 1) {
      const { items, totalCount } = await storeProduct.findPage({ ...filters, page, size: 100 });
      candidates.push(...items);
      if (candidates.length >= totalCount || items.length === 0) break;
    }
    const [ratings, wishlistCounts] = await Promise.all([
      filters.ratingMin !== undefined
        ? engagement.findRatingAverages(candidates.map((item) => item.product_id))
        : new Map(),
      filters.wishlistMin !== undefined
        ? engagement.findWishlistCounts(candidates.map((item) => item.id))
        : new Map(),
    ]);
    const matched = candidates.filter((item) =>
      (filters.ratingMin === undefined || (ratings.get(item.product_id) ?? -1) >= filters.ratingMin)
      && (filters.wishlistMin === undefined || (wishlistCounts.get(item.id) ?? 0) >= filters.wishlistMin)
    );
    const start = (filters.page - 1) * filters.size;
    const items = matched.slice(start, start + filters.size);
    const wished = await wishlistedIds(userId, items);
    return {
      items: items.map((item) => card(item, wished)),
      page: filters.page,
      size: filters.size,
      totalCount: matched.length,
    };
  }

  async function getProducts({ userId, ...filters } = {}) {
    const query = { sort: 'popular', page: 1, size: 20, ...filters };
    if (query.contentCategoryId !== undefined || query.goodsCategoryId !== undefined) {
      requireMethod(productCategory, 'findProductIdsByCategories');
      query.productIds = await productCategory.findProductIdsByCategories({
        contentCategoryId: query.contentCategoryId,
        goodsCategoryId: query.goodsCategoryId,
      });
      if (query.productIds.length === 0) {
        return { items: [], page: query.page, size: query.size, totalCount: 0 };
      }
    }
    return query.ratingMin !== undefined || query.wishlistMin !== undefined
      ? engagementPageResult(query, userId)
      : pageResult(query, userId);
  }

  async function getProductDetail(storeProductId, { userId } = {}) {
    requireMethod(storeProduct, 'findById');
    const listing = await storeProduct.findById(storeProductId);
    if (!listing || ['HIDDEN', 'DELETED'].includes(listing.status)) {
      throw failure('상품을 찾을 수 없습니다.', 404, 'PRODUCT_NOT_FOUND');
    }
    requireMethod(product, 'findById');
    requireMethod(store, 'findById');
    const [productRow, storeRow] = await Promise.all([
      product.findById(listing.product_id),
      store.findById(listing.store_id),
    ]);
    validateProductAvailability(listing, storeRow);
    if (!productRow) throw failure('상품을 찾을 수 없습니다.', 404, 'PRODUCT_NOT_FOUND');
    requireMethod(productImage, 'findByProductId');
    requireMethod(productCategory, 'findByProductId');
    const [images, categories, wished] = await Promise.all([
      productImage.findByProductId(listing.product_id),
      productCategory.findByProductId(listing.product_id),
      wishlistedIds(userId, [listing]),
    ]);
    return {
      ...card({ ...listing, product: productRow, store: storeRow }, wished),
      description: productRow.description ?? null,
      spec: productRow.spec ?? null,
      brand: productRow.brand ?? null,
      workTitle: productRow.work_title ?? null,
      characterName: productRow.character_name ?? null,
      conditionGrade: listing.condition_grade ?? null,
      images,
      categories,
      store: storeRow,
    };
  }

  async function getRelatedProducts(storeProductId, { size = 20, userId } = {}) {
    const detail = await getProductDetail(storeProductId);
    const categoryIds = detail.categories.map((item) => item.category_id);
    if (categoryIds.length === 0) return [];
    requireMethod(productCategory, 'findRelatedProductIds');
    const relatedProductIds = await productCategory.findRelatedProductIds({
      productId: detail.productId,
      categoryIds,
    });
    if (relatedProductIds.length === 0) return [];
    const result = await pageResult(
      {
        relatedProductIds,
        excludeStoreProductId: storeProductId,
        sort: 'popular',
        page: 1,
        size,
      },
      userId
    );
    return result.items;
  }

  // 같은 상품이거나, 같은 작품·굿즈 종류(예: 아이돌 + 키링)이면서 같은 브랜드인 상품을 비슷한 상품으로 본다.
  // 브랜드 정보가 없으면 비교할 수 없어 같은 상품만 본다.
  async function similarProductIds(detail) {
    requireMethod(productCategory, 'findProductIdsByCategories');
    const categoriesOf = (type) =>
      detail.categories.filter((row) => row.category?.type === type).map((row) => row.category);
    const [contents, goods] = [categoriesOf('CONTENT'), categoriesOf('GOODS')];
    const similarIds = new Set([detail.productId]);
    // 작품·굿즈 종류·브랜드 중 하나라도 없으면 너무 넓게 잡히므로 같은 상품만 본다.
    if (!contents.length || !goods.length || !detail.brand) return similarIds;
    requireMethod(product, 'getProducts');
    const candidateIds = new Set();
    for (const content of contents)
      for (const goodsCategory of goods)
        for (const id of await productCategory.findProductIdsByCategories({
          contentCategoryId: content.id,
          goodsCategoryId: goodsCategory.id,
        }))
          candidateIds.add(id);
    for (const row of await product.getProducts([...candidateIds]))
      if (row.brand === detail.brand) similarIds.add(row.id);
    return similarIds;
  }

  // 검색 결과를 "비슷한 상품"으로 좁힐 때 쓰는 범위. 지금 보는 굿즈샵의 상품도 포함하고 그 굿즈샵 id를 알려준다.
  async function getSimilarScope(storeProductId) {
    const detail = await getProductDetail(storeProductId);
    return { productIds: [...(await similarProductIds(detail))], currentStoreId: detail.storeId };
  }

  async function findSimilarListings(storeProductId) {
    const detail = await getProductDetail(storeProductId);
    const similarIds = await similarProductIds(detail);
    requireMethod(storeProduct, 'findPage');
    const listings = [];
    for (let page = 1; ; page += 1) {
      const { items, totalCount } = await storeProduct.findPage({
        productIds: [...similarIds],
        inStock: true,
        page,
        size: 100,
      });
      listings.push(...items);
      if (listings.length >= totalCount || items.length === 0) break;
    }
    // 영업 중이 아닌 굿즈샵의 상품은 추천에서 뺀다.
    return {
      detail,
      listings: listings.filter((listing) => listing.store && listing.store.is_operating === true),
    };
  }

  // includeCurrent가 true면 지금 보는 굿즈샵도 목록 맨 앞에 isCurrent로 표시해 넣는다.
  async function getSimilarStores(storeProductId, { size = 10, includeCurrent = false } = {}) {
    const { detail, listings } = await findSimilarListings(storeProductId);
    const stores = new Map();
    for (const listing of listings) {
      const owner = listing.store;
      if (!owner || (!includeCurrent && owner.id === detail.storeId)) continue;
      const entry = stores.get(owner.id) ?? {
        id: owner.id,
        name: owner.name,
        address: owner.address ?? '',
        region: owner.region?.name ?? '',
        thumbnailUrl: owner.thumbnail_url ?? null,
        pickupAvailable: owner.pickup_available === true,
        deliveryAvailable: owner.delivery_available === true,
        isCurrent: owner.id === detail.storeId,
        hasSameProduct: false,
        matchedCount: 0,
        products: [],
      };
      entry.hasSameProduct ||= listing.product_id === detail.productId;
      entry.matchedCount += 1;
      const item = {
        storeProductId: listing.id,
        name: listing.product?.name ?? '',
        price: listing.price,
      };
      // 같은 상품을 맨 앞에 둬서 카드를 누르면 그 상품 상세로 가게 한다.
      if (listing.product_id === detail.productId) entry.products.unshift(item);
      else entry.products.push(item);
      entry.products = entry.products.slice(0, 3);
      stores.set(owner.id, entry);
    }
    // 현재 상품이 품절이어도 지금 보는 굿즈샵은 빠지지 않게 한다.
    if (includeCurrent && !stores.has(detail.storeId) && detail.store) {
      stores.set(detail.storeId, {
        id: detail.storeId,
        name: detail.storeName,
        address: detail.store.address ?? '',
        region: detail.store.region?.name ?? '',
        thumbnailUrl: detail.store.thumbnail_url ?? null,
        pickupAvailable: detail.store.pickup_available === true,
        deliveryAvailable: detail.store.delivery_available === true,
        isCurrent: true,
        hasSameProduct: true,
        matchedCount: 0,
        products: [],
      });
    }
    return [...stores.values()]
      .sort(
        (a, b) =>
          Number(b.isCurrent) - Number(a.isCurrent) ||
          Number(b.hasSameProduct) - Number(a.hasSameProduct) ||
          b.matchedCount - a.matchedCount ||
          a.name.localeCompare(b.name, 'ko-KR')
      )
      .slice(0, size);
  }

  return { getProducts, getProductDetail, getRelatedProducts, getSimilarStores, getSimilarScope };
}

// Lazy imports keep Controllers loadable while the shared files are awaiting their owners.
async function loadService(userId) {
  try {
    const [storeProduct, product, store, wishlist] = await Promise.all([
      import('../repositories/storeProduct.repository.js'),
      import('../repositories/product.repository.js'),
      import('../repositories/store.repository.js'),
      userId ? import('../repositories/wishlistProduct.repository.js') : undefined,
    ]);
    return createProductService({
      storeProduct,
      product,
      store,
      wishlist,
      productCategory: productCategoryRepository,
      productImage: productImageRepository,
      engagement: productEngagementRepository,
    });
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw failure('공용 상품 Repository 연동이 필요합니다.', 503, 'DEPENDENCY_NOT_READY');
  }
}

export async function getProducts(filters = {}) {
  return (await loadService(filters.userId)).getProducts(filters);
}

export async function getProductDetail(storeProductId, options = {}) {
  return (await loadService(options.userId)).getProductDetail(storeProductId, options);
}

export async function getSimilarScope(storeProductId) {
  return (await loadService()).getSimilarScope(storeProductId);
}

export async function getSimilarStores(storeProductId, options = {}) {
  return (await loadService(options.userId)).getSimilarStores(storeProductId, options);
}

export async function getRelatedProducts(storeProductId, options = {}) {
  return (await loadService(options.userId)).getRelatedProducts(storeProductId, options);
}
