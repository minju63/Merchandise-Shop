// 담당: 연수
// 쿠지 API. 화면은 Supabase 함수(RPC)를 바로 부른다. 함수는 backend/supabase/kuji_step2_functions.sql 에 있다.
import { supabase } from '../../lib/supabase.js';

// 함수가 던지는 'KUJI_...' 코드를 화면 문구로 바꾼다
const MESSAGES = {
  KUJI_LOGIN_REQUIRED: '로그인이 필요해요.',
  KUJI_NOT_FOUND: '쿠지를 찾을 수 없어요.',
  KUJI_NOT_ON_SALE: '지금은 판매 중인 쿠지가 아니에요.',
  KUJI_NO_NUMBERS: '번호를 골라 주세요.',
  KUJI_TOO_MANY: '한 번에 살 수 있는 장수를 넘었어요.',
  KUJI_POINTS_INVALID: '적립금은 티켓 금액보다 많이 쓸 수 없어요.',
  KUJI_POINTS_MIN: '적립금은 1,000원부터 사용할 수 있어요.',
  KUJI_POINTS_SHORT: '보유 적립금이 부족해요.',
  KUJI_TICKET_TAKEN: '다른 분이 먼저 산 번호가 있어요. 번호를 다시 골라 주세요.',
  KUJI_TICKET_NOT_MINE: '내 티켓이 아니에요.',
  KUJI_NOT_OPENED: '아직 뜯지 않은 티켓이에요.',
  KUJI_ALREADY_RESOLD: '이미 되판 상품이에요.',
  KUJI_RESALE_EXPIRED: '뽑은 날부터 7일이 지나 되팔 수 없어요.',
  KUJI_LISTED: '교환글이 올라가 있어요. 교환글을 먼저 취소해 주세요.',
  KUJI_ALREADY_LISTED: '이미 교환글이 올라가 있어요.',
  KUJI_SWAP_BAD_WANT: '같은 등급의 다른 종류만 고를 수 있어요.',
  KUJI_SWAP_ALREADY_DONE: '이미 한 번 교환한 상품이에요.',
  KUJI_LISTING_GONE: '이미 사라졌거나 성사된 교환글이에요.',
  KUJI_SWAP_OWN: '내가 올린 글이에요.',
  KUJI_SWAP_GRADE: '같은 등급끼리만 교환할 수 있어요.',
  KUJI_SWAP_MISMATCH: '상대가 원하는 종류와 달라요.',
};

async function rpc(name, args) {
  if (!supabase) throw new Error('Supabase 설정(.env)이 없어요.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const known = MESSAGES[error.message];
    const missing = error.code === 'PGRST202' || /Could not find the function/.test(error.message ?? '');
    const result = new Error(
      known ??
        (missing
          ? '쿠지 SQL이 아직 적용되지 않았어요. kuji_step1~3 파일을 Supabase에서 실행해 주세요.'
          : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.')
    );
    result.code = error.message;
    throw result;
  }
  return data;
}

export const kujiApi = {
  list: () => rpc('kuji_list'),
  detail: (kujiId) => rpc('kuji_detail', { p_kuji: kujiId }),
  board: (kujiId) => rpc('kuji_board', { p_kuji: kujiId }),
  buy: (kujiId, numbers, points = 0) => rpc('kuji_buy', { p_kuji: kujiId, p_numbers: numbers, p_points: points }),
  myTickets: (kujiId) => rpc('kuji_my_tickets', { p_kuji: kujiId }),
  open: (kujiId, numbers) => rpc('kuji_open', { p_kuji: kujiId, p_numbers: numbers }),
  resale: (kujiId, number) => rpc('kuji_resale', { p_kuji: kujiId, p_number: number }),
  swapList: (kujiId) => rpc('kuji_swap_list', { p_kuji: kujiId }),
  swapPost: (kujiId, number, wantVariantId) =>
    rpc('kuji_swap_post', { p_kuji: kujiId, p_number: number, p_want: wantVariantId }),
  swapAccept: (listingId, number) => rpc('kuji_swap_accept', { p_listing: listingId, p_number: number }),
  swapCancel: (listingId) => rpc('kuji_swap_cancel', { p_listing: listingId }),
};
