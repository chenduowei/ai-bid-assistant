-- 投标工作台 v0.35.0 增量迁移：精确开标时刻 + 中标结果
-- 在 Supabase Dashboard → SQL Editor 执行一次即可（幂等，可重复执行）。
-- 不执行也能用：前端会先探测这两列，旧库自动退回原来的读写范围，
-- 只是「开标时刻」「中标结果」两个字段存不进去（会提示先执行本迁移）。

-- 1) 精确开标时刻（选填）：之前 bid_date 只到「日」，「9:30 开标、迟到即废标」这种硬约束帮不上；
--    加了时刻后：列表倒计时精确到小时，通知文案带时刻，.ics 改成带时间的日程。
alter table public.projects add column if not exists bid_time time;

-- 2) 中标结果（选填）：独立于 status，避免把状态机改复杂。
--    取值：null（未出结果）/ '已中标' / '未中标'。
alter table public.projects add column if not exists result text;

do $$
begin
  alter table public.projects add constraint projects_result_check
    check (result is null or result in ('已中标', '未中标'));
exception
  when duplicate_object then null;
end;
$$;

-- 3) 日历订阅函数补上 bid_time（否则 .ics 只能按全天事件写）。
--    返回列变了不能 CREATE OR REPLACE，先删后建；令牌鉴权逻辑不变。
drop function if exists public.get_calendar_projects(text);

create or replace function public.get_calendar_projects(p_token text)
returns table (
  id uuid,
  name text,
  bid_date date,
  bid_time time,
  project_type text,
  bidding_company text,
  tenderer text,
  contact text,
  notes text
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.name, p.bid_date, p.bid_time, p.project_type, p.bidding_company,
         p.tenderer, p.contact, p.notes
  from public.projects p
  join public.calendar_tokens t on t.user_id = p.user_id
  where t.token = p_token
    and p.deleted_at is null
    and p.bid_date >= current_date
  order by p.bid_date asc;
$$;

grant execute on function public.get_calendar_projects(text) to anon, authenticated;
