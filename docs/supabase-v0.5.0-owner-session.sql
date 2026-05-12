alter table public.decision_records
add column if not exists owner_id text null;

create index if not exists decision_records_owner_updated_at_idx
on public.decision_records(owner_id, updated_at desc);

create table if not exists public.login_sessions (
  user_id text primary key,
  user_name text not null,
  session_id text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.login_sessions enable row level security;

drop policy if exists "Demo read login sessions" on public.login_sessions;
drop policy if exists "Demo insert login sessions" on public.login_sessions;
drop policy if exists "Demo update login sessions" on public.login_sessions;
drop policy if exists "Demo delete login sessions" on public.login_sessions;

create policy "Demo read login sessions"
on public.login_sessions
for select
using (true);

create policy "Demo insert login sessions"
on public.login_sessions
for insert
with check (true);

create policy "Demo update login sessions"
on public.login_sessions
for update
using (true)
with check (true);

create policy "Demo delete login sessions"
on public.login_sessions
for delete
using (true);
