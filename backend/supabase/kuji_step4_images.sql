-- 담당: 연수
-- 굿즈픽 쿠지 4단계: 등급별 상품 사진. kuji_step1~3 을 먼저 실행하고, 상품 사진 경로가 화면에 나오도록
-- kuji_step2_functions.sql 도 한 번 다시 실행한다(kuji_detail 에 imageUrl 이 추가됐다). 여러 번 실행해도 안전하다.
--
-- 사진 파일은 프론트 frontend/public/kuji/<slug>/<등급>.jpg 에 있고, 여기서는 그 경로만 넣는다.

update kuji_prizes p
   set image_url = '/kuji/' || e.slug || '/' || p.grade || '.jpg'
  from kuji_events e
 where e.id = p.kuji_id
   and e.slug in ('starlight-theater', 'moonlight-station');
