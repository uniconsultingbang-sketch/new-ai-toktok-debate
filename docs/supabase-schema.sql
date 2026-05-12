create extension if not exists "pgcrypto";

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  title text not null,
  decision_question text not null,
  background text default '',
  options text default '',
  risks text default '',
  focus_areas jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'completed', 'failed')),
  final_recommendation text null check (
    final_recommendation in ('proceed', 'conditional', 'hold', 'reconsider')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.debate_rounds (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 4),
  round_title text not null,
  bull_message text not null,
  bear_message text not null,
  judge_message text not null,
  created_at timestamptz not null default now(),
  unique (decision_id, round_number)
);

create table if not exists public.final_reports (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null unique references public.decisions(id) on delete cascade,
  summary text not null,
  recommendation text not null,
  key_reasons jsonb not null default '[]'::jsonb,
  key_risks jsonb not null default '[]'::jsonb,
  conditions jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  ai_summaries jsonb not null default '{}'::jsonb,
  pdf_url text null,
  created_at timestamptz not null default now()
);

create table if not exists public.decision_records (
  id uuid primary key,
  title text not null,
  status text not null default 'running',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists decisions_set_updated_at on public.decisions;

create trigger decisions_set_updated_at
before update on public.decisions
for each row
execute function public.set_updated_at();

alter table public.decisions enable row level security;
alter table public.debate_rounds enable row level security;
alter table public.final_reports enable row level security;
alter table public.decision_records enable row level security;

create policy "Demo read decisions"
on public.decisions
for select
using (true);

create policy "Demo insert decisions"
on public.decisions
for insert
with check (true);

create policy "Demo update decisions"
on public.decisions
for update
using (true)
with check (true);

create policy "Demo read debate rounds"
on public.debate_rounds
for select
using (true);

create policy "Demo insert debate rounds"
on public.debate_rounds
for insert
with check (true);

create policy "Demo read final reports"
on public.final_reports
for select
using (true);

create policy "Demo insert final reports"
on public.final_reports
for insert
with check (true);

create policy "Demo read decision records"
on public.decision_records
for select
using (true);

create policy "Demo insert decision records"
on public.decision_records
for insert
with check (true);

create policy "Demo update decision records"
on public.decision_records
for update
using (true)
with check (true);

create policy "Demo delete decision records"
on public.decision_records
for delete
using (true);

create index if not exists decisions_created_at_idx
on public.decisions(created_at desc);

create index if not exists debate_rounds_decision_id_idx
on public.debate_rounds(decision_id);

create index if not exists final_reports_decision_id_idx
on public.final_reports(decision_id);

create index if not exists decision_records_updated_at_idx
on public.decision_records(updated_at desc);

