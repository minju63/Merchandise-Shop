// Preview-only adapter with the same return values as the real category APIs.
// No HTTP/Supabase imports. State resets on page refresh.
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const demoUser = { id: uuid(1), name: '미리보기 사용자' };
export const demoCategories = [
  ...['애니메이션', '게임', '아이돌', '캐릭터', '영화·드라마'].map((name, index) => ({
    id: uuid(10 + index),
    name,
    type: 'CONTENT',
  })),
  ...[
    '포토카드',
    '키링',
    '피규어',
    '아크릴 스탠드',
    '인형',
    '캔뱃지',
    '문구',
    '의류',
    '기타 굿즈',
  ].map((name, index) => ({
    id: uuid(20 + index),
    name,
    type: 'GOODS',
    imageUrl: illustration(['▧', '⚿', '♟', '♙', '♧', '◉', '▤', '♜', '☕'][index], '#eeebf7'),
  })),
];
export const demoRegions = [
  { id: uuid(40), name: '서울' },
  { id: uuid(41), name: '부산' },
];

// Inline SVG sample art avoids external image requests.
function illustration(symbol, color) {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${color}"/><circle cx="300" cy="270" r="140" fill="white" opacity=".7"/><text x="300" y="320" text-anchor="middle" font-size="130">${symbol}</text><text x="300" y="510" text-anchor="middle" font-size="24" fill="#555">SAMPLE GOODS</text></svg>`)}`;
}

const samples = [
  ['나히다 피규어', 11, 22, 32000, 'ON_SALE', 8, '✦', '#e4efdb'],
  ['나히다 아크릴 스탠드', 11, 23, 12000, 'SOLD_OUT', 3, '◇', '#edf1de'],
  ['여행자 키링', 11, 21, 8500, 'ON_SALE', 0, '☀', '#fff0cd'],
  ['별빛 캐릭터 인형', 13, 24, 19000, 'ON_SALE', 12, '★', '#eee2f8'],
  ['애니메이션 캔뱃지', 10, 25, 4500, 'ON_SALE', 20, '☆', '#fce0e9'],
  ['아이돌 포토카드 세트', 12, 20, 15000, 'UPCOMING', 0, '♡', '#ddeafc'],
  ['영화 포스터 노트', 14, 26, 6500, 'ON_SALE', 5, '▤', '#e6e8ee'],
  ['게임 캐릭터 티셔츠', 11, 27, 28000, 'ON_SALE', 4, '✧', '#ffe4d4'],
  ['애니메이션 피규어', 10, 22, 42000, 'ON_SALE', 2, '✦', '#e4e2fb'],
];

export function createCategoryMock(readUser) {
  let currentUser = demoUser;
  const getUser = readUser || (() => currentUser);
  const wishes = new Set();
  const events = [];
  const stores = [0, 1].map((index) => ({
    id: uuid(50 + index),
    name: index ? '부산 굿즈룸' : '서울 굿즈마켓',
    region: demoRegions[index],
    address: index ? '부산 부산진구' : '서울 마포구',
  }));
  const rows = samples.map(
    ([name, contentId, goodsId, price, status, stock, symbol, color], index) => ({
      storeProductId: uuid(100 + index),
      productId: uuid(200 + index),
      productName: name,
      name,
      price,
      discountRate: index === 0 ? 10 : 0,
      status,
      stock,
      thumbnailUrl: illustration(symbol, color),
      images: [
        { id: uuid(400 + index * 2), image_url: illustration(symbol, '#f0eafa') },
        { id: uuid(401 + index * 2), image_url: illustration(symbol, '#eaf0fa') },
      ],
      storeId: stores[index % 2].id,
      storeName: stores[index % 2].name,
      store: stores[index % 2],
      contentCategoryId: uuid(contentId),
      goodsCategoryId: uuid(goodsId),
      categories: [
        demoCategories.find((category) => category.id === uuid(contentId)),
        demoCategories.find((category) => category.id === uuid(goodsId)),
      ],
      pickupAvailable: true,
      deliveryAvailable: index % 3 !== 1,
      description: `${name} 샘플 상품입니다.\n이 데이터는 화면 확인용이며 실제 판매 상품이 아닙니다.`,
      spec: { 소재: '샘플 소재', 구성: '본품 1개' },
      popularity: 100 - index,
      releasedAt: index,
    })
  );
  const inquiries = [
    {
      id: uuid(300),
      user_id: demoUser.id,
      store_id: stores[0].id,
      title: '픽업 가능한가요?',
      content: '이번 주말에 픽업할 수 있나요?',
      status: 'ANSWERED',
      answer_content: '네, 영업시간 안에 방문해 주세요.',
      created_at: '2026-10-10T00:00:00Z',
      inquiry_images: [],
    },
  ];
  let nextInquiryId = 301;
  function requireUser() {
    const user = getUser();
    if (!user)
      throw Object.assign(new Error('로그인이 필요합니다.'), { response: { status: 401 } });
    return user;
  }
  function target(id) {
    const row = rows.find((item) => item.storeProductId === id);
    if (!row)
      throw Object.assign(new Error('상품을 찾을 수 없습니다.'), { response: { status: 404 } });
    return row;
  }
  function card(row) {
    const displayStatus = row.status === 'ON_SALE' && row.stock <= 0 ? 'SOLD_OUT' : row.status;
    return {
      ...row,
      displayStatus,
      canPurchase: displayStatus === 'ON_SALE',
      storeOperating: true,
      isWishlisted: Boolean(getUser()) && wishes.has(`${getUser().id}:${row.storeProductId}`),
    };
  }
  function boolFilter(value, actual) {
    return value === undefined || value === '' || actual === (value === true || value === 'true');
  }
  const api = {
    async getCategories({ type } = {}) {
      return demoCategories.filter((item) => !type || item.type === type);
    },
    async getProducts(filters = {}) {
      if (
        filters.minPrice !== undefined &&
        filters.maxPrice !== undefined &&
        Number(filters.minPrice) > Number(filters.maxPrice)
      ) {
        throw new Error('최소 가격은 최대 가격보다 클 수 없습니다.');
      }
      const page = Number(filters.page || 1),
        size = Number(filters.size || 20);
      if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 100)
        throw new Error('페이지 범위를 확인해 주세요.');
      const items = rows
        .map(card)
        .filter(
          (row) =>
            (!filters.contentCategoryId || row.contentCategoryId === filters.contentCategoryId) &&
            (!filters.goodsCategoryId || row.goodsCategoryId === filters.goodsCategoryId) &&
            (!filters.regionId || row.store.region.id === filters.regionId) &&
            (filters.minPrice === undefined || row.price >= Number(filters.minPrice)) &&
            (filters.maxPrice === undefined || row.price <= Number(filters.maxPrice)) &&
            boolFilter(filters.inStock, row.canPurchase) &&
            boolFilter(filters.pickup, row.pickupAvailable) &&
            boolFilter(filters.delivery, row.deliveryAvailable)
        );
      const comparators = {
        popular: (a, b) => b.popularity - a.popularity,
        newest: (a, b) => b.releasedAt - a.releasedAt,
        price_asc: (a, b) => a.price - b.price,
        price_desc: (a, b) => b.price - a.price,
      };
      const compare = comparators[filters.sort || 'popular'];
      if (!compare) throw new Error('지원하지 않는 정렬 방식입니다.');
      items.sort(compare);
      return {
        items: items.slice((page - 1) * size, page * size),
        page,
        size,
        totalCount: items.length,
      };
    },
    async getProductDetail(id) {
      return card(target(id));
    },
    async getRelatedProducts(id, { size = 8 } = {}) {
      const source = target(id);
      return rows
        .filter(
          (row) =>
            row.storeProductId !== id &&
            (row.contentCategoryId === source.contentCategoryId ||
              row.goodsCategoryId === source.goodsCategoryId)
        )
        .slice(0, size)
        .map(card);
    },
    async getProductInquiries(id, { page = 1, size = 10 } = {}) {
      const storeId = target(id).storeId,
        user = getUser();
      const items = user
        ? inquiries.filter((item) => item.store_id === storeId && item.user_id === user.id)
        : [];
      return {
        items: items.slice((page - 1) * size, page * size),
        page,
        size,
        totalCount: items.length,
      };
    },
    async createProductInquiry(id, { title, content }) {
      const user = requireUser(),
        row = target(id);
      if (!title?.trim() || Array.from(title.trim()).length > 100 || !content?.trim())
        throw new Error('문의 제목과 내용을 확인해 주세요.');
      const inquiry = {
        id: uuid(nextInquiryId++),
        store_id: row.storeId,
        user_id: user.id,
        category: 'PRODUCT',
        title: title.trim(),
        content: content.trim(),
        status: 'PENDING',
        answer_content: null,
        created_at: new Date().toISOString(),
        inquiry_images: [],
      };
      inquiries.unshift(inquiry);
      return inquiry;
    },
  };
  const actions = {
    async wishlist(id, wished) {
      const user = requireUser();
      target(id);
      const key = `${user.id}:${id}`;
      if (wished) wishes.add(key);
      else wishes.delete(key);
    },
  };
  for (const name of ['buy', 'cart', 'restock', 'preorder']) {
    actions[name] = async (id, quantity = 1) => {
      const user = requireUser(),
        row = card(target(id));
      if (['buy', 'cart'].includes(name) && (!row.canPurchase || quantity > row.stock))
        throw new Error('구매할 수 없습니다.');
      if (['restock', 'preorder'].includes(name) && row.displayStatus !== 'SOLD_OUT')
        throw new Error('품절 상품만 신청할 수 있습니다.');
      events.push({ name, id, userId: user.id, quantity });
    };
  }
  return {
    api,
    actions,
    events,
    setUser: (user) => {
      currentUser = user;
    },
  };
}
