import { useState } from 'react';

export const sortOptions = [
  { value: 'popular', label: '인기순' },
  { value: 'newest', label: '신규 입점 순' },
  { value: 'stock', label: '재고 많은 순' },
  { value: 'distance', label: '거리순' },
];

const locationErrors = {
  1: '위치 권한이 거부되어 거리 기능을 쓸 수 없습니다. 브라우저 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.',
  2: '현재 위치를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  3: '위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.',
};

// 위치는 이 요청에만 쓰고 저장하지 않는다. 약 100m 단위로 줄여 사용한다.
function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ message: '이 브라우저는 위치 기능을 지원하지 않습니다.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          lat: Math.round(coords.latitude * 1000) / 1000,
          lng: Math.round(coords.longitude * 1000) / 1000,
        }),
      (error) => reject({ message: locationErrors[error.code] || locationErrors[2] }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// 내 위치 확인 상태와 반경(km)을 관리한다. 위치는 메모리에만 둔다.
export function useStoreLocation() {
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [radiusKm, setRadiusKm] = useState(20);
  const locate = async () => {
    if (location) return location;
    setLocating(true);
    setMessage('');
    try {
      const point = await currentPosition();
      setLocation(point);
      return point;
    } catch (error) {
      setMessage(error.message);
      return null;
    } finally {
      setLocating(false);
    }
  };
  return { location, locating, message, radiusKm, setRadiusKm, locate };
}

function haversineKm(from, to) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// 이미 받아 둔 굿즈샵 목록(검색 결과 등)에 필터·정렬·거리 반경을 적용한다. 서버 목록 API와 같은 기준이다.
export function applyStoreControls(stores, { filters, sort, origin, radiusKm }) {
  let items = stores.filter(
    (store) =>
      (!filters.openNow || store.openNow) &&
      (!filters.pickup || store.pickupAvailable) &&
      (!filters.delivery || store.deliveryAvailable)
  );
  let noCoordinateCount = 0;
  if (origin) {
    items = items.flatMap((store) => {
      if (store.latitude == null || store.longitude == null) {
        noCoordinateCount += 1;
        return [];
      }
      const distanceKm = haversineKm(origin, {
        lat: Number(store.latitude),
        lng: Number(store.longitude),
      });
      return distanceKm > radiusKm
        ? []
        : [{ ...store, distanceKm: Math.round(distanceKm * 10) / 10 }];
    });
  }
  const created = (store) => String(store.createdAt || '');
  items.sort(
    (a, b) =>
      (sort === 'distance'
        ? a.distanceKm - b.distanceKm
        : sort === 'newest'
          ? created(b).localeCompare(created(a))
          : sort === 'stock'
            ? Number(b.availableProductCount || 0) - Number(a.availableProductCount || 0)
            : Number(b.viewCount || 0) - Number(a.viewCount || 0)) ||
      created(b).localeCompare(created(a)) ||
      a.id.localeCompare(b.id)
  );
  return { items, noCoordinateCount };
}
