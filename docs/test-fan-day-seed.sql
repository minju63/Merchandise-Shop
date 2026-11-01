-- 테스트용: "오늘 기념일인 최애" 화면 확인 데이터 (2026-12-07 생일 3명).
-- 홈의 고죠 사토루 배너(banners.event_date = 2026-12-07)를 누르면 이 날짜 화면으로 들어간다.
-- backend/supabase/fan_cheer_step12.sql 실행 후 Supabase SQL Editor 에서 실행한다(여러 번 실행해도 안전).
-- 응원(cheers)·정산(cheer_results) 데이터는 만들지 않아서, 이 화면에는 "오늘 생일인 최애" 작은 카드로 보인다.
-- 1위 카드·응원 순위까지 보려면 fan_cheer_test_winner.sql 같은 응원 데이터가 그 날짜 슬롯에 있어야 한다.

insert into characters (name, work_title) values
  ('고죠 사토루', '주술회전'),
  ('후시구로 메구미', '주술회전'),
  ('쿠기사키 노바라', '주술회전')
on conflict (name, work_title) do nothing;

insert into anniversaries (character_id, kind, event_date, label, base_year)
select c.id, 'BIRTHDAY', date '2026-12-07', '[테스트] ' || c.name || ' 생일', null
  from characters c
 where c.work_title = '주술회전' and c.name in ('고죠 사토루', '후시구로 메구미', '쿠기사키 노바라')
on conflict (character_id, kind, event_date) do nothing;

-- 화면에서 바로 숫자가 보이도록 넣는 목업 기본 축하 수.
-- 실제 사용자가 하트를 누른 수는 congrats_likes에 별도로 쌓이고 이 값에 더해진다.
insert into congrats_like_seeds (event_date, character_id, like_count)
select a.event_date, c.id,
       case c.name
         when '고죠 사토루' then 3284
         when '후시구로 메구미' then 1436
         when '쿠기사키 노바라' then 1092
       end
  from characters c
  join anniversaries a on a.character_id = c.id
                      and a.kind = 'BIRTHDAY'
                      and a.is_active
 where c.work_title = '주술회전'
   and c.name in ('고죠 사토루', '후시구로 메구미', '쿠기사키 노바라')
on conflict (event_date, character_id) do update set like_count = excluded.like_count;

-- 확인용: 화면 날짜에 해당하는 행이 3개이고 like_count가 아래 값으로 보여야 한다.
select a.event_date, c.name, s.like_count
  from congrats_like_seeds s
  join characters c on c.id = s.character_id
  join anniversaries a on a.character_id = c.id and a.event_date = s.event_date and a.kind = 'BIRTHDAY'
 where c.work_title = '주술회전'
   and c.name in ('고죠 사토루', '후시구로 메구미', '쿠기사키 노바라')
 order by a.event_date, c.name;
