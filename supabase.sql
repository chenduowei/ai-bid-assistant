-- 项目管理工作台：Supabase 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中一次性执行。

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  project_type text not null check (char_length(trim(project_type)) > 0),
  contact text not null check (char_length(trim(contact)) > 0),
  bid_date date not null,
  guarantee text not null check (char_length(trim(guarantee)) > 0),
  status text not null default '报名中' check (status in ('报名中', '制作中', '已开标')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_bid_date_idx on public.projects (user_id, bid_date);

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

-- 每位已登录用户只能读写自己的记录。
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

-- 启用跨设备的实时刷新。若项目之前已加入 publication，此块可安全重复运行。
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
