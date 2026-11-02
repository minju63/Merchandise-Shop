-- 담당: 연수
-- 굿즈픽 쿠지 2단계: 화면이 호출하는 함수(RPC). kuji_step1_tables.sql 을 먼저 실행한다.
-- Supabase SQL Editor에서 실행한다. 여러 번 실행해도 안전하다(create or replace).
--
-- · 모든 함수는 security definer 이고, 로그인한 사용자는 auth.uid() 로 가려낸다.
--   번호별 상품(kuji_tickets)은 이 함수들만 읽을 수 있어서 구매 전에는 알 수 없다.
-- · 오류는 'KUJI_...' 코드를 메시지로 던지고, 화면(frontend/src/pages/kuji/kuji.api.js)이 문구로 바꾼다.
-- · 교환 수수료는 한 사람당 1,990원이며 모의 결제다(kuji_swaps.fee_each 에 기록만 한다).
-- · 되팔기 금액은 kuji_prizes.buyback_price(등급별 고정)이며 적립금(point_transactions)으로만 돌려준다.

-- 로그인한 사용자 id. 로그인하지 않았으면 오류.
create or replace function kuji_uid()
returns uuid
language plpgsql
stable
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'KUJI_LOGIN_REQUIRED'; end if;
  return v_user;
end;
$$;

-- 티켓 1장을 화면용 JSON 으로 바꾼다 (함수 안에서만 쓴다)
create or replace function kuji_ticket_json(p_ticket uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ticketId', t.id,
    'number', t.number,
    'grade', t.grade,
    'variantId', t.variant_id,
    'variantLabel', v.label,
    'name', p.name,
    'description', p.description,
    'retailPrice', p.retail_price,
    'buybackPrice', p.buyback_price,
    'soldAt', t.sold_at,
    'openedAt', t.opened_at,
    'resoldAt', t.resold_at,
    'swapCount', t.swap_count,
    'listed', exists (select 1 from kuji_swap_listings l where l.ticket_id = t.id and l.status = 'OPEN'),
    'resaleUntil', t.sold_at + interval '7 days'
  )
  from kuji_tickets t
  join kuji_prize_variants v on v.id = t.variant_id
  join kuji_prizes p on p.id = v.prize_id
  where t.id = p_ticket;
$$;

-- 교환글 1개를 화면용 JSON 으로 바꾼다 (함수 안에서만 쓴다)
create or replace function kuji_swap_item(p_listing uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', l.id,
    'grade', l.grade,
    'haveVariantId', t.variant_id,
    'haveLabel', hv.label,
    'wantVariantId', l.want_variant_id,
    'wantLabel', wv.label,
    'nick', coalesce(u.nickname, t.seed_owner_name, '익명'),
    'mine', l.user_id is not distinct from auth.uid() and l.user_id is not null,
    'ticketNumber', case when l.user_id is not null and l.user_id = auth.uid() then t.number end,
    'createdAt', l.created_at
  )
  from kuji_swap_listings l
  join kuji_tickets t on t.id = l.ticket_id
  join kuji_prize_variants hv on hv.id = t.variant_id
  join kuji_prize_variants wv on wv.id = l.want_variant_id
  left join users u on u.id = l.user_id
  where l.id = p_listing;
$$;

-- ── 목록: 판매 중 · 오픈 예정 쿠지와 남은 티켓
create or replace function kuji_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(s.item order by s.sort_order, s.created_at), '[]'::jsonb)
  from (
    select e.sort_order, e.created_at, jsonb_build_object(
      'id', e.id,
      'slug', e.slug,
      'title', e.title,
      'coverUrl', e.cover_url,
      'bannerUrl', e.banner_url,
      'shopName', e.shop_name,
      'status', e.status,
      'ticketPrice', e.ticket_price,
      'totalTickets', e.total_tickets,
      'leftTickets', (select count(*) from kuji_tickets t where t.kuji_id = e.id and t.sold_at is null),
      'leftByGrade', (
        select coalesce(jsonb_object_agg(g.grade, g.cnt), '{}'::jsonb)
        from (select t.grade, count(*) as cnt from kuji_tickets t where t.kuji_id = e.id and t.sold_at is null group by t.grade) g
      ),
      'opensAt', e.opens_at,
      'closesAt', e.closes_at
    ) as item
    from kuji_events e
    where e.status in ('ON_SALE', 'UPCOMING')
  ) s;
$$;

-- ── 상세: 쿠지 정보 + 등급별 상품 · 남은 수량 · 종류
create or replace function kuji_detail(p_kuji uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event kuji_events;
begin
  select * into v_event from kuji_events where id = p_kuji;
  if not found then raise exception 'KUJI_NOT_FOUND'; end if;

  return jsonb_build_object(
    'id', v_event.id,
    'slug', v_event.slug,
    'title', v_event.title,
    'shopName', v_event.shop_name,
    'status', v_event.status,
    'ticketPrice', v_event.ticket_price,
    'totalTickets', v_event.total_tickets,
    'maxPerPurchase', v_event.max_per_purchase,
    'lastOneText', v_event.last_one_text,
    'leftTickets', (select count(*) from kuji_tickets t where t.kuji_id = p_kuji and t.sold_at is null),
    'myTicketCount', (select count(*) from kuji_tickets t where t.kuji_id = p_kuji and t.owner_id = auth.uid()),
    'prizes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'grade', p.grade,
        'name', p.name,
        'description', p.description,
        'imageUrl', p.image_url,
        'retailPrice', p.retail_price,
        'buybackPrice', p.buyback_price,
        'totalCount', p.total_count,
        'leftCount', (select count(*) from kuji_tickets t where t.kuji_id = p.kuji_id and t.grade = p.grade and t.sold_at is null),
        'variants', (
          select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'label', v.label) order by v.sort_order), '[]'::jsonb)
          from kuji_prize_variants v where v.prize_id = p.id
        )
      ) order by p.grade), '[]'::jsonb)
      from kuji_prizes p where p.kuji_id = p_kuji
    )
  );
end;
$$;

-- ── 번호판: 번호마다 판매 여부와 내가 산 번호인지
create or replace function kuji_board(p_kuji uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'number', t.number,
    'sold', t.sold_at is not null,
    'mine', t.owner_id is not null and t.owner_id = auth.uid()
  ) order by t.number), '[]'::jsonb)
  from kuji_tickets t
  where t.kuji_id = p_kuji;
$$;

-- ── 구매: 고른 번호를 한꺼번에 산다 (모의 결제). 다른 사람이 먼저 샀으면 전체가 실패한다.
create or replace function kuji_buy(p_kuji uuid, p_numbers integer[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := kuji_uid();
  v_event kuji_events;
  v_numbers integer[];
  v_count integer;
  v_ids uuid[];
  v_purchase uuid;
begin
  select * into v_event from kuji_events where id = p_kuji;
  if not found then raise exception 'KUJI_NOT_FOUND'; end if;
  if v_event.status <> 'ON_SALE' then raise exception 'KUJI_NOT_ON_SALE'; end if;

  select array_agg(distinct n) into v_numbers from unnest(p_numbers) as n;
  v_count := coalesce(cardinality(v_numbers), 0);
  if v_count = 0 then raise exception 'KUJI_NO_NUMBERS'; end if;
  if v_count > v_event.max_per_purchase then raise exception 'KUJI_TOO_MANY'; end if;

  select array_agg(s.id order by s.number) into v_ids
  from (
    select t.id, t.number from kuji_tickets t
    where t.kuji_id = p_kuji and t.number = any(v_numbers) and t.sold_at is null
    order by t.number
    for update
  ) s;
  if coalesce(cardinality(v_ids), 0) <> v_count then raise exception 'KUJI_TICKET_TAKEN'; end if;

  update kuji_tickets set owner_id = v_user, sold_at = now() where id = any(v_ids);

  insert into kuji_purchases (kuji_id, user_id, ticket_count, amount)
  values (p_kuji, v_user, v_count, v_count * v_event.ticket_price)
  returning id into v_purchase;

  return jsonb_build_object(
    'purchaseId', v_purchase,
    'amount', v_count * v_event.ticket_price,
    'tickets', (
      select coalesce(jsonb_agg(kuji_ticket_json(u.id) order by u.ord), '[]'::jsonb)
      from unnest(v_ids) with ordinality as u(id, ord)
    )
  );
end;
$$;

-- ── 내 티켓: 이 쿠지에서 내가 산 티켓과 들어 있는 상품
create or replace function kuji_my_tickets(p_kuji uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(kuji_ticket_json(t.id) order by t.number), '[]'::jsonb)
  from kuji_tickets t
  where t.kuji_id = p_kuji and t.owner_id = kuji_uid();
$$;

-- ── 개봉: 뜯은 티켓을 기록한다 (새로고침해도 뜯은 상태가 유지된다)
create or replace function kuji_open(p_kuji uuid, p_numbers integer[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := kuji_uid();
  v_changed integer;
begin
  update kuji_tickets
     set opened_at = now()
   where kuji_id = p_kuji and owner_id = v_user and opened_at is null and number = any(p_numbers);
  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

-- ── 되팔기: 뜯은 상품을 적립금으로 바꾼다 (뽑은 날부터 7일 이내, 1번만)
create or replace function kuji_resale(p_kuji uuid, p_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := kuji_uid();
  v_ticket kuji_tickets;
  v_amount integer;
  v_balance bigint;
begin
  select * into v_ticket from kuji_tickets
   where kuji_id = p_kuji and number = p_number and owner_id = v_user for update;
  if not found then raise exception 'KUJI_TICKET_NOT_MINE'; end if;
  if v_ticket.opened_at is null then raise exception 'KUJI_NOT_OPENED'; end if;
  if v_ticket.resold_at is not null then raise exception 'KUJI_ALREADY_RESOLD'; end if;
  if v_ticket.sold_at < now() - interval '7 days' then raise exception 'KUJI_RESALE_EXPIRED'; end if;
  if exists (select 1 from kuji_swap_listings l where l.ticket_id = v_ticket.id and l.status = 'OPEN') then
    raise exception 'KUJI_LISTED';
  end if;

  select p.buyback_price into v_amount
    from kuji_prize_variants v join kuji_prizes p on p.id = v.prize_id
   where v.id = v_ticket.variant_id;

  insert into point_transactions (user_id, type, status, amount, memo, kuji_ticket_id)
  values (v_user, 'KUJI_RESALE', 'CONFIRMED', v_amount, '쿠지 되팔기 ' || v_ticket.grade || '상 ' || lpad(v_ticket.number::text, 2, '0') || '번', v_ticket.id);

  update kuji_tickets set resold_at = now() where id = v_ticket.id;

  select coalesce(sum(amount), 0) into v_balance
    from point_transactions where user_id = v_user and status = 'CONFIRMED';

  return jsonb_build_object('amount', v_amount, 'balance', v_balance);
end;
$$;

-- ── 교환글 목록 (열려 있는 글)
create or replace function kuji_swap_list(p_kuji uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(kuji_swap_item(l.id) order by l.created_at desc), '[]'::jsonb)
  from kuji_swap_listings l
  where l.kuji_id = p_kuji and l.status = 'OPEN';
$$;

-- ── 교환글 올리기: 같은 등급 안에서 받고 싶은 종류를 정한다. 바로 맞는 글이 있으면 match 로 알려 준다.
create or replace function kuji_swap_post(p_kuji uuid, p_number integer, p_want uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := kuji_uid();
  v_ticket kuji_tickets;
  v_want kuji_prize_variants;
  v_listing uuid;
  v_match uuid;
begin
  select * into v_ticket from kuji_tickets
   where kuji_id = p_kuji and number = p_number and owner_id = v_user for update;
  if not found then raise exception 'KUJI_TICKET_NOT_MINE'; end if;
  if v_ticket.opened_at is null then raise exception 'KUJI_NOT_OPENED'; end if;
  if v_ticket.resold_at is not null then raise exception 'KUJI_ALREADY_RESOLD'; end if;
  if v_ticket.swap_count > 0 then raise exception 'KUJI_SWAP_ALREADY_DONE'; end if;
  if exists (select 1 from kuji_swap_listings l where l.ticket_id = v_ticket.id and l.status = 'OPEN') then
    raise exception 'KUJI_ALREADY_LISTED';
  end if;

  select * into v_want from kuji_prize_variants where id = p_want;
  if not found or v_want.kuji_id <> p_kuji or v_want.grade <> v_ticket.grade or v_want.id = v_ticket.variant_id then
    raise exception 'KUJI_SWAP_BAD_WANT';
  end if;

  insert into kuji_swap_listings (kuji_id, ticket_id, user_id, grade, want_variant_id)
  values (p_kuji, v_ticket.id, v_user, v_ticket.grade, p_want)
  returning id into v_listing;

  select l.id into v_match
    from kuji_swap_listings l
    join kuji_tickets t on t.id = l.ticket_id
   where l.kuji_id = p_kuji and l.status = 'OPEN' and l.grade = v_ticket.grade
     and t.variant_id = p_want and l.want_variant_id = v_ticket.variant_id
     and l.user_id is distinct from v_user
     and t.resold_at is null and t.swap_count = 0
   order by l.created_at
   limit 1;

  return jsonb_build_object(
    'listingId', v_listing,
    'match', case when v_match is null then null else kuji_swap_item(v_match) end
  );
end;
$$;

-- ── 교환 성사: 내 티켓과 상대 티켓의 상품 종류를 바로 맞바꾼다. 같은 쿠지 · 같은 등급만 가능하다.
create or replace function kuji_swap_accept(p_listing uuid, p_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee constant integer := 1990;
  v_user uuid := kuji_uid();
  v_listing kuji_swap_listings;
  v_other kuji_tickets;
  v_mine kuji_tickets;
  v_give text;
  v_get text;
  v_nick text;
begin
  select * into v_listing from kuji_swap_listings where id = p_listing and status = 'OPEN' for update;
  if not found then raise exception 'KUJI_LISTING_GONE'; end if;
  if v_listing.user_id is not distinct from v_user then raise exception 'KUJI_SWAP_OWN'; end if;

  select * into v_other from kuji_tickets where id = v_listing.ticket_id for update;
  if v_other.resold_at is not null or v_other.swap_count > 0 then raise exception 'KUJI_LISTING_GONE'; end if;

  select * into v_mine from kuji_tickets
   where kuji_id = v_listing.kuji_id and number = p_number and owner_id = v_user for update;
  if not found then raise exception 'KUJI_TICKET_NOT_MINE'; end if;
  if v_mine.opened_at is null then raise exception 'KUJI_NOT_OPENED'; end if;
  if v_mine.resold_at is not null then raise exception 'KUJI_ALREADY_RESOLD'; end if;
  if v_mine.swap_count > 0 then raise exception 'KUJI_SWAP_ALREADY_DONE'; end if;
  if v_mine.grade <> v_listing.grade or v_other.grade <> v_listing.grade then raise exception 'KUJI_SWAP_GRADE'; end if;
  if v_mine.variant_id <> v_listing.want_variant_id then raise exception 'KUJI_SWAP_MISMATCH'; end if;

  select label into v_give from kuji_prize_variants where id = v_mine.variant_id;
  select label into v_get from kuji_prize_variants where id = v_other.variant_id;
  select coalesce(u.nickname, v_other.seed_owner_name, '익명') into v_nick
    from (select 1) x left join users u on u.id = v_listing.user_id;

  -- 내 티켓에 올려 둔 교환글이 있으면 닫는다
  update kuji_swap_listings set status = 'CANCELED', closed_at = now()
   where ticket_id = v_mine.id and status = 'OPEN';

  update kuji_tickets set variant_id = v_other.variant_id, swap_count = swap_count + 1 where id = v_mine.id;
  update kuji_tickets set variant_id = v_mine.variant_id, swap_count = swap_count + 1 where id = v_other.id;
  update kuji_swap_listings set status = 'MATCHED', closed_at = now() where id = v_listing.id;

  insert into kuji_swaps (kuji_id, listing_id, accepter_ticket_id, lister_ticket_id, accepter_user_id, lister_user_id, fee_each)
  values (v_listing.kuji_id, v_listing.id, v_mine.id, v_other.id, v_user, v_listing.user_id, v_fee);

  return jsonb_build_object(
    'fee', v_fee,
    'grade', v_mine.grade,
    'number', v_mine.number,
    'giveLabel', v_give,
    'getLabel', v_get,
    'nick', v_nick
  );
end;
$$;

-- ── 교환글 취소: 내가 올린 글만
create or replace function kuji_swap_cancel(p_listing uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := kuji_uid();
  v_changed integer;
begin
  update kuji_swap_listings set status = 'CANCELED', closed_at = now()
   where id = p_listing and user_id = v_user and status = 'OPEN';
  get diagnostics v_changed = row_count;
  return v_changed > 0;
end;
$$;

-- ── 실행 권한: 안쪽 도우미 함수는 아무도 직접 부르지 못하고, 나머지는 필요한 사람만 부른다.
revoke execute on function kuji_uid(), kuji_ticket_json(uuid), kuji_swap_item(uuid) from public, anon, authenticated;

revoke execute on function kuji_list(), kuji_detail(uuid), kuji_board(uuid) from public;
grant execute on function kuji_list(), kuji_detail(uuid), kuji_board(uuid) to anon, authenticated;

revoke execute on function
  kuji_buy(uuid, integer[]), kuji_my_tickets(uuid), kuji_open(uuid, integer[]), kuji_resale(uuid, integer),
  kuji_swap_list(uuid), kuji_swap_post(uuid, integer, uuid), kuji_swap_accept(uuid, integer), kuji_swap_cancel(uuid)
  from public, anon;
grant execute on function
  kuji_buy(uuid, integer[]), kuji_my_tickets(uuid), kuji_open(uuid, integer[]), kuji_resale(uuid, integer),
  kuji_swap_list(uuid), kuji_swap_post(uuid, integer, uuid), kuji_swap_accept(uuid, integer), kuji_swap_cancel(uuid)
  to authenticated;
