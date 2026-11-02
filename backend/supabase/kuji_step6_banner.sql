-- 담당: 연수
-- 굿즈픽 쿠지 6단계: 쿠지 목록 상단 배너 이미지(bannerUrl). kuji_step1~5 를 먼저 실행한다. 여러 번 실행해도 안전하다.

alter table kuji_events add column if not exists banner_url text;

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

update kuji_events set banner_url = '/kuji/' || slug || '/banner.jpg' where slug in ('starlight-theater', 'moonlight-station');
