-- 에어컨탐정 Supabase 설정 (단정 오피스케어와 같은 Supabase 프로젝트에 추가합니다)
-- Supabase 대시보드 > SQL Editor 에 이 내용을 통째로 붙여넣고 Run 을 누르세요.
-- 여러 번 실행해도 안전하고, 단정 오피스케어의 기존 테이블은 건드리지 않습니다.

-- 사건 기록(블로그 글)
create table if not exists public.ac_posts (
  id          text primary key,
  title       text not null,
  cat         text not null default 'clean' check (cat in ('clean','repair','install')),
  excerpt     text not null default '',
  cover       text not null default '',
  blocks      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 견적 의뢰
create table if not exists public.ac_quotes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  service     text not null default '',
  area        text not null default '',
  aircon      text not null default '',
  memo        text not null default '',
  status      text not null default '신규' check (status in ('신규','연락완료','견적발송','종료')),
  sms_sent    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- 보안: RLS를 켜고 정책을 만들지 않습니다. 브라우저에서 직접은 아무도 못 읽고, 사이트 서버(비밀 키)만 접근합니다.
alter table public.ac_posts  enable row level security;
alter table public.ac_quotes enable row level security;

grant select, insert, update, delete on public.ac_posts, public.ac_quotes to service_role;

-- 사진 저장소는 단정과 같은 'media' 버킷을 쓰고, 에어컨탐정 사진은 acposts/ 폴더에 따로 저장됩니다.
