// 카카오 로컬 키워드 검색으로 홍대·압구정·광안리 같은 장소 이름을 좌표로 바꾼다. 같은 검색어는 한 시간 동안 다시 부르지 않는다.
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map();

export async function geocodeKeyword(keyword) {
  const text = String(keyword ?? '').trim();
  const key = process.env.KAKAO_REST_API_KEY;
  if (!text || !key) return null;
  const hit = cache.get(text);
  if (hit && hit.at > Date.now() - CACHE_MS) return hit.value;
  let value = null;
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?size=1&query=${encodeURIComponent(text)}`,
      { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(3000) },
    );
    if (response.ok) {
      const place = (await response.json()).documents?.[0];
      if (place) value = { name: place.place_name, latitude: Number(place.y), longitude: Number(place.x) };
    }
  } catch {
    return null;
  }
  cache.set(text, { at: Date.now(), value });
  return value;
}
