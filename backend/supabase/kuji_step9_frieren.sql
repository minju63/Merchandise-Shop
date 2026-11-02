-- 담당: 연수
-- 굿즈픽 쿠지 9단계: 「장송의 프리렌 쿠지」(오픈 예정) 추가 · 오픈 예정 데이터 정리.
-- kuji_step1~6 을 먼저 실행한다. 이미 있는 쿠지(slug)는 건너뛰므로 여러 번 실행해도 안전하다.
--
-- · 오픈 예정 쿠지 상세 화면에 오픈 일시를 보여 주려고 kuji_detail 에 opensAt 를 추가한다.
-- · 프리렌 쿠지는 2026-11-18(수) 14:00 오픈 예정(11월 셋째 주)이다. 사진은 frontend/public/kuji/frieren-journey/ 에 있다.
-- · 상품 종류 이름은 실제 캐릭터 이름이다. 다른 구매자의 교환글 6개가 함께 들어간다(시연용).
-- · 자리만 채워 두었던 오픈 예정 「모래시계 학원 쿠지」는 목록에서 빠지도록 CLOSED 로 바꾼다(삭제하지 않는다).
-- · 모든 금액은 개발용 예시다.

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
    'opensAt', v_event.opens_at,
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

revoke execute on function kuji_detail(uuid) from public;
grant execute on function kuji_detail(uuid) to anon, authenticated;

do $$
declare
  v_cfg jsonb;
  v_prize jsonb;
  v_label text;
  v_event uuid;
  v_prize_id uuid;
  v_idx integer;
  v_listing jsonb;
  v_ticket uuid;
  v_want uuid;
begin
  perform setseed(0.2026);

  for v_cfg in select * from jsonb_array_elements($cfg$[
    {
      "slug": "frieren-journey", "title": "장송의 프리렌 쿠지", "shop": "프리렌 여행 굿즈샵",
      "status": "UPCOMING", "price": 9000, "total": 60, "sort": 3,
      "opensAt": "2026-11-18T14:00:00+09:00",
      "prizes": [
        {"grade": "A", "name": "프리렌 스테인드 피규어", "desc": "스테인드글라스 아트 패널 포함", "retail": 79000, "buyback": 20000, "count": 2, "variants": ["단일"]},
        {"grade": "B", "name": "프리렌 대형 피규어", "desc": "데포르메 대형 사이즈", "retail": 42000, "buyback": 10000, "count": 3, "variants": ["단일"]},
        {"grade": "C", "name": "미니 피규어", "desc": "미니 피규어 7종 / 프리렌·프리렌(눈 감음)·페른·페른(목도리)·슈타르크·힘멜·미믹", "retail": 19000, "buyback": 4800, "count": 7, "variants": ["프리렌", "프리렌(눈 감음)", "페른", "페른(목도리)", "슈타르크", "힘멜", "미믹"]},
        {"grade": "D", "name": "캐릭터 얼굴 쿠션", "desc": "쿠션 4종 / 프리렌·페른·슈타르크·아우라", "retail": 15000, "buyback": 3500, "count": 8, "variants": ["프리렌", "페른", "슈타르크", "아우라"]},
        {"grade": "E", "name": "캐릭터 스트랩", "desc": "스트랩 6종 / 프리렌·페른·슈타르크·힘멜·하이터·아이젠", "retail": 8000, "buyback": 2300, "count": 12, "variants": ["프리렌", "페른", "슈타르크", "힘멜", "하이터", "아이젠"]},
        {"grade": "F", "name": "아크릴 카드", "desc": "아크릴 카드 10종 / 프리렌(꽃관)·프리렌(머플러)·힘멜·페른·슈타르크·프리렌&힘멜·하이터&아이젠·프리렌&페른·페른&슈타르크·용사 파티", "retail": 4000, "buyback": 1000, "count": 28, "variants": ["프리렌(꽃관)", "프리렌(머플러)", "힘멜", "페른", "슈타르크", "프리렌&힘멜", "하이터&아이젠", "프리렌&페른", "페른&슈타르크", "용사 파티"]}
      ],
      "listings": [
        {"grade": "C", "have": "미믹", "want": "프리렌", "nick": "hana_pick", "minutes": 8},
        {"grade": "C", "have": "힘멜", "want": "페른", "nick": "night_owl", "minutes": 21},
        {"grade": "D", "have": "아우라", "want": "프리렌", "nick": "kuji_fan", "minutes": 35},
        {"grade": "E", "have": "아이젠", "want": "힘멜", "nick": "deok_hu", "minutes": 52},
        {"grade": "E", "have": "슈타르크", "want": "페른", "nick": "bae_ji", "minutes": 90},
        {"grade": "F", "have": "용사 파티", "want": "프리렌&힘멜", "nick": "pink_bear", "minutes": 180}
      ]
    }
  ]$cfg$::jsonb) loop
    if exists (select 1 from kuji_events where slug = v_cfg->>'slug') then continue; end if;

    insert into kuji_events (slug, title, shop_name, status, ticket_price, total_tickets, opens_at, sort_order, cover_url, banner_url)
    values (v_cfg->>'slug', v_cfg->>'title', v_cfg->>'shop', v_cfg->>'status', (v_cfg->>'price')::integer,
            (v_cfg->>'total')::integer, (v_cfg->>'opensAt')::timestamptz, (v_cfg->>'sort')::integer,
            '/kuji/' || (v_cfg->>'slug') || '/cover.jpg', '/kuji/' || (v_cfg->>'slug') || '/banner.jpg')
    returning id into v_event;

    for v_prize in select * from jsonb_array_elements(v_cfg->'prizes') loop
      insert into kuji_prizes (kuji_id, grade, name, description, retail_price, buyback_price, total_count, image_url)
      values (v_event, v_prize->>'grade', v_prize->>'name', v_prize->>'desc', (v_prize->>'retail')::integer,
              (v_prize->>'buyback')::integer, (v_prize->>'count')::integer,
              '/kuji/' || (v_cfg->>'slug') || '/' || (v_prize->>'grade') || '.jpg')
      returning id into v_prize_id;

      v_idx := 0;
      for v_label in select * from jsonb_array_elements_text(v_prize->'variants') loop
        insert into kuji_prize_variants (prize_id, kuji_id, grade, label, sort_order)
        values (v_prize_id, v_event, v_prize->>'grade', v_label, v_idx);
        v_idx := v_idx + 1;
      end loop;
    end loop;

    -- 번호마다 상품을 정한다: 등급별 수량만큼 만들고 한 번 섞어 1번부터 번호를 붙인다.
    insert into kuji_tickets (kuji_id, number, grade, variant_id)
    select v_event, row_number() over (order by random())::integer, s.grade, s.variant_id
    from (
      select p.grade, va.ids[1 + (g.i - 1) % cardinality(va.ids)] as variant_id
      from kuji_prizes p
      cross join lateral (
        select array_agg(v.id order by v.sort_order) as ids from kuji_prize_variants v where v.prize_id = p.id
      ) va
      cross join lateral generate_series(1, p.total_count) as g(i)
      where p.kuji_id = v_event
    ) s;

    -- 다른 구매자의 교환글. 해당 종류를 가진 티켓을 골라 글에 붙인다.
    for v_listing in select * from jsonb_array_elements(v_cfg->'listings') loop
      select t.id into v_ticket
        from kuji_tickets t
        join kuji_prize_variants hv on hv.id = t.variant_id
       where t.kuji_id = v_event and t.grade = v_listing->>'grade' and hv.label = v_listing->>'have'
         and not exists (select 1 from kuji_swap_listings x where x.ticket_id = t.id)
       order by t.number
       limit 1;

      select v.id into v_want
        from kuji_prize_variants v
       where v.kuji_id = v_event and v.grade = v_listing->>'grade' and v.label = v_listing->>'want';

      if v_ticket is not null and v_want is not null then
        update kuji_tickets
           set sold_at = now() - interval '1 day', opened_at = now() - interval '1 day',
               seed_owner_name = v_listing->>'nick'
         where id = v_ticket;

        insert into kuji_swap_listings (kuji_id, ticket_id, user_id, grade, want_variant_id, created_at)
        values (v_event, v_ticket, null, v_listing->>'grade', v_want, now() - ((v_listing->>'minutes') || ' minutes')::interval);
      end if;
    end loop;
  end loop;
end
$$;

-- 자리만 채워 두었던 오픈 예정 쿠지는 목록에서 뺀다(데이터는 남겨 둔다). 다시 보이게 하려면 status 를 'UPCOMING' 으로 되돌린다.
update kuji_events set status = 'CLOSED' where slug = 'hourglass-academy' and status = 'UPCOMING';

-- 개발용: 프리렌 쿠지를 처음 상태로 되돌리고 싶으면 아래 주석을 풀어 실행한 뒤 이 파일을 다시 실행한다.
-- delete from kuji_events where slug = 'frieren-journey';
