import { REGIONS } from '../../constants/regions.js';

export const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchesTokens(values, tokens) {
  const target = values.filter(Boolean).join(' ').toLocaleLowerCase('ko-KR');
  return tokens.every((token) => target.includes(token));
}

export function getAutocompleteSuggestions(query, data, products, shops, storeId) {
  const tokens = query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const regionItems = storeId ? [] : data.regions
    .filter((region) => {
      const names = [region.label, region.displayName, ...region.aliases]
        .map((name) => name.toLocaleLowerCase('ko-KR'));
      const matchesQuery = tokens.some((token) => names.some((name) => name.includes(token)));
      const hasResults = shops.some((shop) => matchesRegion(shop, region));
      return matchesQuery && hasResults;
    })
    .map((region) => ({
      id: `region-${region.id}`,
      type: '지역',
      label: region.displayName,
      subtitle: region.label === region.displayName ? '지역 검색' : region.label,
      regionId: region.id,
      searchValue: region.label,
    }));

  const entityItems = [
    ...products.map((product) => ({
      id: `product-${product.storeProductId}`,
      type: '굿즈',
      label: product.name,
      subtitle: product.storeName,
      searchValue: product.name,
    })),
    ...products.filter((product) => product.workTitle && matchesTokens([product.workTitle], tokens))
      .map((product) => ({
        id: `work-${product.workTitle}`,
        type: '작품',
        label: product.workTitle,
        subtitle: product.storeName,
        searchValue: product.workTitle,
      })),
    ...products.filter((product) => product.characterName && matchesTokens([product.characterName], tokens))
      .map((product) => ({
        id: `character-${product.characterName}`,
        type: '캐릭터',
        label: product.characterName,
        subtitle: product.workTitle || product.storeName,
        searchValue: product.characterName,
      })),
    ...(storeId ? [] : shops.filter((shop) => matchesTokens([shop.name, shop.address], tokens))
      .map((shop) => ({
        id: `shop-${shop.id}`,
        type: '굿즈샵',
        label: shop.name,
        subtitle: shop.address,
        searchValue: shop.name,
      }))),
  ];

  // 굿즈가 많아도 굿즈샵·지역이 밀려나지 않게 종류별로 몇 개씩만 담는다.
  const mapRegions = storeId ? [] : getMapRegionSuggestions(query, shops, REGIONS);
  const regions = [...new Map([...regionItems, ...mapRegions].map((item) => [item.id, item])).values()];
  const entities = [...new Map(entityItems.map((item) => [item.id, item])).values()];
  const take = (items, type, limit) => items.filter((item) => item.type === type).slice(0, limit);
  return [
    ...regions.slice(0, 3),
    ...take(entities, '굿즈샵', 3),
    ...take(entities, '작품', 2),
    ...take(entities, '캐릭터', 2),
    ...take(entities, '굿즈', 4),
  ];
}

export function matchesRegion(location, region) {
  if (!location || !region) return false;
  if (location.address) {
    const address = location.address.toLocaleLowerCase('ko-KR');
    return (!region.sido || address.includes(region.sido.slice(0, 2).toLocaleLowerCase('ko-KR')))
      && (!region.sigungu || address.includes(region.sigungu.toLocaleLowerCase('ko-KR')))
      && (!region.area || address.includes(region.area.toLocaleLowerCase('ko-KR')));
  }
  return (!region.sido || location.sido === region.sido)
    && (!region.sigungu || location.sigungu === region.sigungu)
    && (!region.area || location.area === region.area);
}

// 지도 검색창용 지역 자동완성: 시·도 이름과, 지도에 보이는 굿즈샵 주소의 시·군·구에서 만든다.
export function getMapRegionSuggestions(query, shops, sidoNames = []) {
  const tokens = query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const hit = (name) => tokens.every((token) => name.toLocaleLowerCase('ko-KR').includes(token));
  const places = new Map();
  for (const name of sidoNames) places.set(name, { label: name, subtitle: '시·도', count: 0 });
  for (const shop of shops) {
    const [sido, district] = (shop.address ?? '').split(/\s+/);
    if (!sido) continue;
    if (places.has(sido)) places.get(sido).count += 1;
    if (district && /[시군구]$/.test(district)) {
      const label = `${sido} ${district}`;
      const place = places.get(label) ?? { label, subtitle: '시·군·구', count: 0 };
      place.count += 1;
      places.set(label, place);
    }
  }
  return [...places.values()]
    .filter((place) => hit(place.label))
    .slice(0, 5)
    .map((place) => ({
      id: `region-${place.label}`,
      type: '지역',
      label: place.label,
      subtitle: place.count ? `${place.subtitle} · 굿즈샵 ${place.count}곳` : place.subtitle,
      searchValue: place.label,
    }));
}


// 홍대·광안리처럼 장소로 찾을 수 있는 검색어는 굿즈와 별개로 '지역' 후보를 맨 위에 하나 더한다.
export function withAreaSuggestion(suggestions, query, area) {
  const label = query.trim();
  if (!area || !label || suggestions.some((item) => item.type === '지역' && item.label === label)) return suggestions;
  return [
    { id: `area-${label}`, type: '지역', label, subtitle: `${area.name} 주변`, searchValue: label },
    ...suggestions,
  ];
}
