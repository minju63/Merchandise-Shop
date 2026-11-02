-- 담당: 연수
-- 굿즈픽 쿠지 3단계: 시드 데이터. kuji_step1_tables.sql · kuji_step2_functions.sql 을 먼저 실행한다.
-- Supabase SQL Editor에서 실행한다. 이미 있는 쿠지(slug)는 건너뛰므로 여러 번 실행해도 안전하다.
--
-- · 번호별 상품은 고정 시드(setseed)로 한 번만 섞는다. 같은 등급 안의 종류는 번호 순서대로 돌아가며 들어간다.
-- · 일부 티켓은 "다른 구매자"가 이미 산 상태로 넣는다(owner_id 없이 seed_owner_name 만 있다).
-- · 첫 번째 쿠지에는 다른 구매자의 교환글을 몇 개 넣어, 교환 화면을 바로 써볼 수 있게 한다.
-- · 모든 금액과 상품은 개발용 예시다.

do $$
declare
  v_cfg jsonb;
  v_prize jsonb;
  v_label text;
  v_event uuid;
  v_prize_id uuid;
  v_idx integer;
  v_names text[] := array['mio_dd', '별빛수집가', 'luna_k', '쿠지러버', 'sera0815', '굿즈덕후'];
  v_listing jsonb;
  v_ticket uuid;
  v_want uuid;
  v_mod integer;
begin
  perform setseed(0.2026);

  for v_cfg in select * from jsonb_array_elements($cfg$[
    {
      "slug": "starlight-theater", "title": "스타라이트 극장 쿠지", "shop": "별빛 극장 공식 굿즈샵",
      "status": "ON_SALE", "price": 9500, "total": 80, "sort": 1, "soldMod": 4,
      "lastOne": "마지막 한 장을 뽑으면 특별 상품을 드려요",
      "prizes": [
        {"grade": "A", "name": "스타라이트 퀸 대형 피규어", "desc": "높이 약 28cm · 한정 채색", "retail": 89000, "buyback": 20000, "count": 2, "variants": ["단일"]},
        {"grade": "B", "name": "무대 의상 아크릴 스탠드", "desc": "12cm · 2종 중 1종", "retail": 29000, "buyback": 10000, "count": 3, "variants": ["무대", "교복"]},
        {"grade": "C", "name": "대형 쿠션", "desc": "40cm · 일러스트 프린트", "retail": 19000, "buyback": 4800, "count": 5, "variants": ["일러 A", "일러 B"]},
        {"grade": "D", "name": "러버 키링 세트", "desc": "2개 1세트", "retail": 12000, "buyback": 3500, "count": 10, "variants": ["별", "달", "왕관"]},
        {"grade": "E", "name": "클리어 파일 2종", "desc": "A4 · 2장 1세트", "retail": 6000, "buyback": 2300, "count": 20, "variants": ["A 세트", "B 세트"]},
        {"grade": "F", "name": "미니 핀 배지", "desc": "랜덤 1종 · 25mm", "retail": 3000, "buyback": 1000, "count": 40, "variants": ["라이", "세라", "미오", "루나"]}
      ],
      "listings": [
        {"grade": "B", "have": "무대", "want": "교복", "nick": "mio_dd", "minutes": 3},
        {"grade": "D", "have": "별", "want": "왕관", "nick": "별빛수집가", "minutes": 12},
        {"grade": "D", "have": "달", "want": "별", "nick": "luna_k", "minutes": 25},
        {"grade": "E", "have": "A 세트", "want": "B 세트", "nick": "쿠지러버", "minutes": 41},
        {"grade": "F", "have": "루나", "want": "라이", "nick": "sera0815", "minutes": 60},
        {"grade": "C", "have": "일러 B", "want": "일러 A", "nick": "굿즈덕후", "minutes": 120}
      ]
    },
    {
      "slug": "moonlight-station", "title": "달빛 정거장 쿠지", "shop": "달빛 정거장 굿즈샵",
      "status": "ON_SALE", "price": 8500, "total": 40, "sort": 2, "soldMod": 2,
      "lastOne": null,
      "prizes": [
        {"grade": "A", "name": "달빛 열차 대형 인형", "desc": "높이 약 30cm", "retail": 79000, "buyback": 20000, "count": 1, "variants": ["단일"]},
        {"grade": "B", "name": "정거장 아크릴 스탠드", "desc": "12cm · 2종 중 1종", "retail": 27000, "buyback": 10000, "count": 2, "variants": ["밤", "새벽"]},
        {"grade": "C", "name": "별 무늬 담요", "desc": "100 x 70cm", "retail": 18000, "buyback": 4800, "count": 3, "variants": ["별", "달"]},
        {"grade": "D", "name": "동물 키링", "desc": "랜덤 1종", "retail": 11000, "buyback": 3500, "count": 5, "variants": ["토끼", "고양이", "곰"]},
        {"grade": "E", "name": "엽서 세트", "desc": "5장 1세트", "retail": 5500, "buyback": 2300, "count": 9, "variants": ["A", "B"]},
        {"grade": "F", "name": "미니 배지", "desc": "랜덤 1종 · 25mm", "retail": 3000, "buyback": 1000, "count": 20, "variants": ["1번", "2번", "3번", "4번"]}
      ],
      "listings": []
    },
    {
      "slug": "hourglass-academy", "title": "모래시계 학원 쿠지", "shop": "모래시계 학원 굿즈샵",
      "status": "UPCOMING", "price": 9000, "total": 60, "sort": 3, "soldMod": 0,
      "lastOne": null, "opensAt": "2026-11-08T14:00:00+09:00",
      "prizes": [], "listings": []
    }
  ]$cfg$::jsonb) loop
    if exists (select 1 from kuji_events where slug = v_cfg->>'slug') then continue; end if;

    insert into kuji_events (slug, title, shop_name, status, ticket_price, total_tickets, last_one_text, opens_at, sort_order)
    values (v_cfg->>'slug', v_cfg->>'title', v_cfg->>'shop', v_cfg->>'status', (v_cfg->>'price')::integer,
            (v_cfg->>'total')::integer, v_cfg->>'lastOne', (v_cfg->>'opensAt')::timestamptz, (v_cfg->>'sort')::integer)
    returning id into v_event;

    for v_prize in select * from jsonb_array_elements(v_cfg->'prizes') loop
      insert into kuji_prizes (kuji_id, grade, name, description, retail_price, buyback_price, total_count)
      values (v_event, v_prize->>'grade', v_prize->>'name', v_prize->>'desc', (v_prize->>'retail')::integer,
              (v_prize->>'buyback')::integer, (v_prize->>'count')::integer)
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

    -- 다른 구매자가 이미 산 티켓. 가장 높은 A상 번호는 항상 남겨 둔다.
    v_mod := (v_cfg->>'soldMod')::integer;
    if v_mod > 0 then
      update kuji_tickets t
         set sold_at = now() - ((t.number % 7 + 1) || ' hours')::interval,
             opened_at = now() - ((t.number % 7) || ' hours')::interval,
             seed_owner_name = v_names[1 + t.number % cardinality(v_names)]
       where t.kuji_id = v_event
         and (
           t.number % v_mod = 1
           or (t.grade = 'A' and t.number = (select min(x.number) from kuji_tickets x where x.kuji_id = v_event and x.grade = 'A')
               and (select count(*) from kuji_tickets x where x.kuji_id = v_event and x.grade = 'A') >= 2)
         )
         and not (t.grade = 'A' and t.number = (select max(x.number) from kuji_tickets x where x.kuji_id = v_event and x.grade = 'A'));
    end if;

    -- 다른 구매자의 교환글. 해당 종류를 가진 티켓(이미 산 티켓을 먼저)을 골라 글에 붙인다.
    for v_listing in select * from jsonb_array_elements(v_cfg->'listings') loop
      select t.id into v_ticket
        from kuji_tickets t
        join kuji_prize_variants hv on hv.id = t.variant_id
       where t.kuji_id = v_event and t.grade = v_listing->>'grade' and hv.label = v_listing->>'have'
         and not exists (select 1 from kuji_swap_listings x where x.ticket_id = t.id)
       order by (t.sold_at is null), t.number
       limit 1;

      select v.id into v_want
        from kuji_prize_variants v
       where v.kuji_id = v_event and v.grade = v_listing->>'grade' and v.label = v_listing->>'want';

      if v_ticket is not null and v_want is not null then
        update kuji_tickets
           set sold_at = coalesce(sold_at, now() - interval '1 day'),
               opened_at = coalesce(opened_at, now() - interval '1 day'),
               seed_owner_name = v_listing->>'nick'
         where id = v_ticket;

        insert into kuji_swap_listings (kuji_id, ticket_id, user_id, grade, want_variant_id, created_at)
        values (v_event, v_ticket, null, v_listing->>'grade', v_want, now() - ((v_listing->>'minutes') || ' minutes')::interval);
      end if;
    end loop;
  end loop;
end
$$;

-- 개발용: 시드 쿠지를 처음 상태로 되돌리고 싶으면 아래 주석을 풀어 실행한다 (내 티켓 · 교환글 · 구매 내역이 모두 지워진다).
-- delete from point_transactions where type = 'KUJI_RESALE';
-- delete from kuji_events where slug in ('starlight-theater', 'moonlight-station', 'hourglass-academy');
-- 그다음 이 파일을 다시 실행한다.
