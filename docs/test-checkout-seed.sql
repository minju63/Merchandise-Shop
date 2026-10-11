-- 결제(C-01) 실제 서버 테스트용 시드. Supabase SQL Editor에서 실행.
-- 필요한 것: ① 매장 요금제(수수료율) ② 배달 가능 지역(모모굿즈 → 서울 마포구)
-- 픽업 주문은 ①만 있으면 되고, 배달 주문은 ①②가 모두 필요하다.

-- ① 매장 요금제. stores.membership_plan = 'BASIC' → code 'STORE_BASIC'를 찾는다.
insert into public.membership_plans (code, target, name, monthly_price, commission_rate, preorder_enabled, alert_priority_minutes, benefits, is_active)
values ('STORE_BASIC', 'STORE', '입점 베이직', 0, 10, false, 0, '[]'::jsonb, true)
on conflict (code) do nothing;

-- ② 배달 지역. regions.level 허용값을 몰라서 후보를 차례로 시도한다. 하나도 안 맞으면 NOTICE에 안내가 뜬다.
do $$
declare
  pair text[];
  pairs text[][] := array[['SIDO','SIGUNGU'], ['CITY','DISTRICT'], ['PROVINCE','CITY'], ['L1','L2'], ['1','2']];
  parent uuid := '20000000-0000-4000-8000-0000000000a1';
  child  uuid := '20000000-0000-4000-8000-0000000000a2';
  done boolean := false;
begin
  if exists (select 1 from public.regions where id = child) then
    done := true;
  else
    foreach pair slice 1 in array pairs loop
      begin
        insert into public.regions (id, parent_id, name, level, aliases, sort_order, is_active)
        values (parent, null, '서울특별시', pair[1], array['서울','서울시'], 1, true);
        insert into public.regions (id, parent_id, name, level, aliases, sort_order, is_active)
        values (child, parent, '마포구', pair[2], array[]::text[], 1, true);
        done := true;
        exit;
      exception when others then
        null; -- 이 후보는 맞지 않음. 하위 트랜잭션이 롤백되고 다음 후보로 간다.
      end;
    end loop;
  end if;

  if not done then
    raise notice 'regions.level 값을 찾지 못했어요. regions 테이블의 level 허용값을 알려 주세요.';
  else
    insert into public.store_delivery_areas (store_id, region_id, extra_fee)
    select '10000000-0000-4000-8000-000000000001', child, 0
    where not exists (
      select 1 from public.store_delivery_areas
      where store_id = '10000000-0000-4000-8000-000000000001' and region_id = child
    );
  end if;
end $$;

-- 배달 테스트 때는 마이 > 배송지에서 도로명 주소를 "서울 마포구 ..."로 시작하게 등록한다. (예: 서울 마포구 월드컵북로 400)

-- ───── 정리(테스트가 끝나면 실행) ─────
-- delete from public.store_delivery_areas where region_id = '20000000-0000-4000-8000-0000000000a2';
-- delete from public.regions where id in ('20000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-0000000000a1');
-- delete from public.membership_plans where code = 'STORE_BASIC';
