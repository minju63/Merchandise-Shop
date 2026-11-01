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
