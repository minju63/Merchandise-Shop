-- 담당: 연수
-- 굿즈픽 쿠지 7단계: 다른 구매자의 교환글 추가 시드(개발용 예시). kuji_step1~6 을 먼저 실행한다.
-- 같은 닉네임의 글이 그 쿠지에 이미 있으면 건너뛰므로 여러 번 실행해도 안전하다.
-- 종류 이름은 직접 적지 않는다. 그 등급에 실제로 등록된 종류(kuji_prize_variants.label) 중에서 티켓이 가진 종류와,
-- 그 다음 순서의 종류를 원하는 것으로 골라 글을 만든다. 먼저 이 파일로 넣었던 글(닉네임 기준)은 지우고 다시 넣는다.

do $$
declare
  v_cfg jsonb;
  v_l jsonb;
  v_event uuid;
  v_ticket uuid;
  v_have uuid;
  v_want uuid;
begin
  for v_cfg in select * from jsonb_array_elements($cfg$[
    {
      "slug": "starlight-theater",
      "listings": [
        {"grade": "B", "nick": "hana_pick", "minutes": 8},
        {"grade": "C", "nick": "pink_bear", "minutes": 18},
        {"grade": "D", "nick": "kuji_fan", "minutes": 33},
        {"grade": "E", "nick": "deok_hu", "minutes": 52},
        {"grade": "F", "nick": "night_owl", "minutes": 95}
      ]
    },
    {
      "slug": "moonlight-station",
      "listings": [
        {"grade": "B", "nick": "chii_lover", "minutes": 5},
        {"grade": "C", "nick": "하치와레", "minutes": 14},
        {"grade": "D", "nick": "usagi_2", "minutes": 27},
        {"grade": "D", "nick": "모몽가", "minutes": 44},
        {"grade": "E", "nick": "엽서수집", "minutes": 70},
        {"grade": "F", "nick": "bae_ji", "minutes": 130}
      ]
    }
  ]$cfg$::jsonb) loop
    select id into v_event from kuji_events where slug = v_cfg->>'slug';
    if v_event is null then continue; end if;

    delete from kuji_swap_listings x
     using kuji_tickets xt
     where xt.id = x.ticket_id and x.kuji_id = v_event and x.status = 'OPEN' and x.user_id is null
       and xt.seed_owner_name in (select l->>'nick' from jsonb_array_elements(v_cfg->'listings') l);

    for v_l in select * from jsonb_array_elements(v_cfg->'listings') loop
      select t.id, t.variant_id into v_ticket, v_have
        from kuji_tickets t
       where t.kuji_id = v_event and t.grade = v_l->>'grade'
         and t.owner_id is null and t.resold_at is null and t.swap_count = 0
         and not exists (select 1 from kuji_swap_listings x where x.ticket_id = t.id)
         and (select count(*) from kuji_prize_variants v where v.kuji_id = v_event and v.grade = t.grade) >= 2
       order by (t.sold_at is null), t.number
       limit 1;
      if v_ticket is null then continue; end if;

      select v.id into v_want from kuji_prize_variants v
       where v.kuji_id = v_event and v.grade = v_l->>'grade' and v.id <> v_have
       order by (v.sort_order <= (select sort_order from kuji_prize_variants where id = v_have)), v.sort_order
       limit 1;

      update kuji_tickets
         set sold_at = coalesce(sold_at, now() - interval '1 day'),
             opened_at = coalesce(opened_at, now() - interval '1 day'),
             seed_owner_name = v_l->>'nick'
       where id = v_ticket;

      insert into kuji_swap_listings (kuji_id, ticket_id, user_id, grade, want_variant_id, created_at)
      values (v_event, v_ticket, null, v_l->>'grade', v_want, now() - ((v_l->>'minutes') || ' minutes')::interval);
    end loop;
  end loop;
end
$$;
