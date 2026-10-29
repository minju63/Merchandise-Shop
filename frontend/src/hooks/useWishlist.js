import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wishlistApi } from '../api/wishlist.api.js';
import { useSession } from '../pages/my/hooks.js';

const IDS_KEY = ['wishlist', 'ids'];

// 내 찜 목록 전체의 상품(storeProductId)·굿즈샵(storeId) id를 한 번 불러와, 여러 화면의 하트가 같이 쓴다.
async function fetchAll(load, idOf) {
  const ids = [];
  for (let page = 1; ; page += 1) {
    const response = await load({ page, size: 100 });
    const items = response.data.items;
    ids.push(...items.map(idOf));
    if (!items.length || ids.length >= response.data.totalCount) return ids;
  }
}

export default function useWishlist() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { status, session } = useSession();
  const loggedIn = status === 'in';
  const { data } = useQuery({
    queryKey: [...IDS_KEY, session?.user?.id],
    queryFn: async () => {
      const [products, shops] = await Promise.all([
        fetchAll(wishlistApi.products, (item) => item.storeProductId),
        fetchAll(wishlistApi.shops, (item) => item.storeId),
      ]);
      return { products, shops };
    },
    enabled: loggedIn,
    staleTime: 30000,
    retry: false,
  });
  const key = [...IDS_KEY, session?.user?.id];
  const products = new Set(data?.products ?? []);
  const shops = new Set(data?.shops ?? []);

  const toggle = useCallback(
    async (kind, id) => {
      // 비회원이 하트를 누르면 로그인 화면으로 보낸다.
      if (!loggedIn) {
        navigate(`/login?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
        return;
      }
      const field = kind === 'product' ? 'products' : 'shops';
      const previous = queryClient.getQueryData(key) ?? { products: [], shops: [] };
      const wished = previous[field].includes(id);
      queryClient.setQueryData(key, {
        ...previous,
        [field]: wished ? previous[field].filter((item) => item !== id) : [...previous[field], id],
      });
      try {
        if (kind === 'product') await (wished ? wishlistApi.removeProduct(id) : wishlistApi.addProduct(id));
        else await (wished ? wishlistApi.removeShop(id) : wishlistApi.addShop(id));
        // 찜 탭의 목록과 개수도 새로 불러오게 한다.
        queryClient.invalidateQueries({ queryKey: ['wishlist', kind === 'product' ? 'products' : 'shops'] });
        queryClient.invalidateQueries({ queryKey: ['wishlist', 'counts'] });
      } catch {
        queryClient.setQueryData(key, previous);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loggedIn, location.pathname, location.search, navigate, queryClient, session?.user?.id]
  );

  return {
    loggedIn,
    isProductWished: (id) => products.has(id),
    isShopWished: (id) => shops.has(id),
    toggleProduct: (id) => toggle('product', id),
    toggleShop: (id) => toggle('shop', id),
  };
}
