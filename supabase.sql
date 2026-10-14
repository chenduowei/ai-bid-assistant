-- 项目管理工作台：Supabase 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中一次性执行。
-- 若已有旧表，可再执行文末「增量迁移」段落。

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  project_type text not null check (char_length(trim(project_type)) > 0),
  bidding_company text not null default '' check (char_length(trim(bidding_company)) > 0),
  tenderer text,
  amount text,
  contact text not null check (char_length(trim(contact)) > 0),
  bid_date date not null,
  guarantee text not null check (char_length(trim(guarantee)) > 0),
  status text not null default '报名中' check (status in ('报名中', '制作中', '已开标')),
  notes text,
  -- AI 分析结果（可选）
  risk_summary text,
  risk_points jsonb,
  qualification jsonb,
  invalid_bid_clauses jsonb,
  extracted_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- v0.2.7 软删除：删除 = 移入回收站，deleted_at 为空表示正常
  deleted_at timestamptz,
  -- v0.3.0：废标检查清单（[{id, text, done, source}]）
  checklist jsonb,
  -- v0.3.0：结构化金额 / 保证金（旧 amount / guarantee 文本列保留作兼容）
  amount_value numeric,
  amount_unit text,
  guarantee_amount numeric,
  guarantee_unit text,
  guarantee_status text,
  -- v0.3.0：多截止时间
  registration_deadline date,
  inquiry_deadline date,
  clarification_deadline date,
  guarantee_deadline date,
  -- v0.3.0：PDF 文本持久化
  pdf_text text,
  pdf_filename text,
  pdf_parsed_at timestamptz
);

create index if not exists projects_user_id_bid_date_idx on public.projects (user_id, bid_date);
create index if not exists projects_deleted_at_idx on public.projects (deleted_at);

-- 关页提醒去重日志（Edge Function 用，service_role 写入，用户只能读自己的）
create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  stage text not null check (stage in ('today', 'tomorrow')),
  sent_at timestamptz not null default now(),
  unique (user_id, project_id, stage)
);
alter table public.notification_log enable row level security;
drop policy if exists "Users can read their own notification log" on public.notification_log;
create policy "Users can read their own notification log"
on public.notification_log for select to authenticated
using ((select auth.uid()) = user_id);
grant select on public.notification_log to authenticated;


create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Users can read their own projects" on public.projects;
create policy "Users can read their own projects"
on public.projects for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own projects" on public.projects;
create policy "Users can create their own projects"
on public.projects for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own projects" on public.projects;
create policy "Users can update their own projects"
on public.projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own projects" on public.projects;
create policy "Users can delete their own projects"
on public.projects for delete to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.projects to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime' and pr.prrelid = 'public.projects'::regclass
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;
end;
$$;

-- ========== 增量迁移（已有旧库时执行）==========

-- 1) 增加「投标公司」字段（已有数据先允许为空，再按需回填）
alter table public.projects add column if not exists bidding_company text;

-- 2) 恢复 status 为三态枚举
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.projects'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.projects drop constraint %I', constraint_name);
  end loop;

  update public.projects
  set status = '报名中'
  where status is null or status not in ('报名中', '制作中', '已开标');

  begin
    alter table public.projects
      add constraint projects_status_check
      check (status in ('报名中', '制作中', '已开标'));
  exception
    when duplicate_object then null;
  end;
end;
$$;

-- 3) AI 分析字段（若尚未添加）
alter table public.projects add column if not exists risk_summary text;
alter table public.projects add column if not exists risk_points jsonb;
alter table public.projects add column if not exists extracted_meta jsonb;

-- 4) v0.2.4 P0：招标单位、项目金额、结构化资格/废标条款
alter table public.projects add column if not exists tenderer text;
alter table public.projects add column if not exists amount text;
alter table public.projects add column if not exists qualification jsonb;
alter table public.projects add column if not exists invalid_bid_clauses jsonb;

-- 5) 投标公司非空约束（仅在确认无空值后可执行；默认先不强制旧数据）
-- update public.projects set bidding_company = '未填写' where bidding_company is null or trim(bidding_company) = '';
-- alter table public.projects alter column bidding_company set not null;

-- 6) v0.2.7：软删除 + 关页提醒日志
alter table public.projects add column if not exists deleted_at timestamptz;
create index if not exists projects_deleted_at_idx on public.projects (deleted_at);
create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  stage text not null check (stage in ('today', 'tomorrow')),
  sent_at timestamptz not null default now(),
  unique (user_id, project_id, stage)
);
alter table public.notification_log enable row level security;
drop policy if exists "Users can read their own notification log" on public.notification_log;
create policy "Users can read their own notification log"
on public.notification_log for select to authenticated
using ((select auth.uid()) = user_id);
grant select on public.notification_log to authenticated;

-- 7) v0.3.0：检查清单 + 结构化金额/保证金 + 多截止时间 + PDF 持久化
alter table public.projects add column if not exists checklist jsonb;
alter table public.projects add column if not exists amount_value numeric;
alter table public.projects add column if not exists amount_unit text;
alter table public.projects add column if not exists guarantee_amount numeric;
alter table public.projects add column if not exists guarantee_unit text;
alter table public.projects add column if not exists guarantee_status text;
alter table public.projects add column if not exists registration_deadline date;
alter table public.projects add column if not exists inquiry_deadline date;
alter table public.projects add column if not exists clarification_deadline date;
alter table public.projects add column if not exists guarantee_deadline date;
alter table public.projects add column if not exists pdf_text text;
alter table public.projects add column if not exists pdf_filename text;
alter table public.projects add column if not exists pdf_parsed_at timestamptz;
do $$ begin
  alter table public.projects add constraint projects_amount_unit_check
    check (amount_unit is null or amount_unit in ('元', '万元'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_guarantee_unit_check
    check (guarantee_unit is null or guarantee_unit in ('元', '万元'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.projects add constraint projects_guarantee_status_check
    check (guarantee_status is null or guarantee_status in ('未缴纳', '已缴纳', '已退回', '已没收'));
exception when duplicate_object then null; end $$;
