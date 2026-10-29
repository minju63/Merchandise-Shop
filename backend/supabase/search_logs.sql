create table if not exists search_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  query varchar(200) not null,
  normalized_query varchar(200) not null,
  result_count integer not null check (result_count >= 0),
  region_id varchar(100),
  searched_at timestamptz not null default now()
);

create index if not exists search_logs_analysis_idx
  on search_logs (result_count, searched_at desc);

create index if not exists search_logs_keyword_idx
  on search_logs (normalized_query, searched_at desc);

alter table search_logs enable row level security;

-- 검색 로그는 Express의 service_role 클라이언트만 기록·조회합니다.
-- 클라이언트용 RLS 정책은 의도적으로 만들지 않습니다.
