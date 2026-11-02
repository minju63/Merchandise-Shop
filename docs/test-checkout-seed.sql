-- 결제(C-01) 실제 서버 테스트용 시드. Supabase SQL Editor에서 실행.
-- 필요한 것: 매장 요금제(수수료율).
-- 배달 가능 지역은 전국으로 고정되어 regions/store_delivery_areas 시드가 필요하지 않다.

-- 매장 요금제. stores.membership_plan = 'BASIC' → code 'STORE_BASIC'를 찾는다.
insert into public.membership_plans (code, target, name, monthly_price, commission_rate, preorder_enabled, alert_priority_minutes, benefits, is_active)
values ('STORE_BASIC', 'STORE', '입점 베이직', 0, 10, false, 0, '[]'::jsonb, true)
on conflict (code) do nothing;

-- ───── 정리(테스트가 끝나면 실행) ─────
-- delete from public.membership_plans where code = 'STORE_BASIC';
