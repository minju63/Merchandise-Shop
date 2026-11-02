-- 담당: 연수
-- 굿즈픽 쿠지 5단계: 쿠지 대표 사진(coverUrl) · 쿠지 이름 수정. kuji_step1~4 를 먼저 실행한다. 여러 번 실행해도 안전하다.

alter table kuji_events add column if not exists cover_url text;

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

update kuji_events set cover_url = '/kuji/starlight-theater/cover.jpg' where slug = 'starlight-theater';
update kuji_events set title = '나의 히어로 아카데미아 특집' where slug = 'starlight-theater';
update kuji_events set title = '작고 귀여운 친구들 쿠지' where slug = 'moonlight-station';
update kuji_events set cover_url = '/kuji/moonlight-station/cover.jpg' where slug = 'moonlight-station';
