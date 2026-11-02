-- 담당: 연수
-- 굿즈픽 쿠지 8단계: 내 진열장에 실제 상품 사진이 나오도록 티켓 정보에 imageUrl 을 넣는다.
-- kuji_step1~4 를 먼저 실행한다(image_url 이 채워져 있어야 한다). 여러 번 실행해도 안전하다.

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
    'imageUrl', p.image_url,
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

revoke execute on function kuji_ticket_json(uuid) from public, anon, authenticated;
