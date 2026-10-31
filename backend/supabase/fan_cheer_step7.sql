-- 응원 7단계: 응원 결과 화면에 지난 응모 기록 함께 보여주기
-- 최근 정산 주차 결과(fan_result_for_user)에 이전 정산 주차 최대 3개의 내 결과를 pastWeeks 로 덧붙인다.
-- 응원 기록이 있는 주차만 담는다. fan_cheer_step4.sql 실행 후 한 번 실행한다.
create or replace function fan_result_with_history(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest jsonb := fan_result_for_user(p_user, null);
  v_past jsonb;
begin
  select coalesce(jsonb_agg(w.item order by w.week_start desc), '[]'::jsonb) into v_past
    from (
      select o.week_start,
             fan_result_for_user(p_user, o.id) || jsonb_build_object('weekStart', o.week_start) as item
        from fan_banner_weeks o
       where o.settled_at is not null
         and o.id is distinct from (v_latest->>'weekId')::uuid
         and o.week_start < coalesce((select week_start from fan_banner_weeks where id = (v_latest->>'weekId')::uuid), 'infinity'::date)
         and exists (select 1 from cheers c where c.week_id = o.id and c.user_id = p_user)
       order by o.week_start desc
       limit 3
    ) w;

  return v_latest
      || jsonb_build_object('weekStart', (select week_start from fan_banner_weeks where id = (v_latest->>'weekId')::uuid))
      || jsonb_build_object('pastWeeks', v_past);
end;
$$;

revoke execute on function fan_result_with_history from public, anon, authenticated;
