-- Bellcast v0.1 schema.
-- Single-tenant: every topic belongs to the one instance owner.
-- Clients never touch Postgres directly; the API uses service_role.

create extension if not exists pgcrypto;

create table if not exists public.messages (
  seq             bigint generated always as identity primary key,
  id              uuid not null unique default gen_random_uuid(),
  topic           text not null
                    check (topic ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  title           text,
  body            text not null,
  priority        smallint not null default 3
                    check (priority between 1 and 5),
  tags            text[] not null default '{}',
  click_url       text,
  actions         jsonb,
  idempotency_key text not null default gen_random_uuid()::text,
  created_at      timestamptz not null default now(),
  unique (topic, idempotency_key)
);

create index if not exists messages_topic_seq_idx
  on public.messages (topic, seq desc);
create index if not exists messages_seq_idx
  on public.messages (seq);
create index if not exists messages_created_idx
  on public.messages (created_at);

alter table public.messages enable row level security;

-- No policies. Only service_role can read or write.
-- Defense in depth: remove the default grants Supabase gives to the API roles.
revoke all on public.messages from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Atomic publish: idempotent per (topic, key), no separate topics table.
create or replace function public.publish_message(
  p_topic    text,
  p_title    text,
  p_body     text,
  p_priority smallint,
  p_tags     text[],
  p_click    text,
  p_actions  jsonb,
  p_idem     text
) returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg public.messages;
begin
  insert into public.messages
    (topic, title, body, priority, tags, click_url, actions, idempotency_key)
  values
    (p_topic, p_title, p_body, p_priority, coalesce(p_tags, '{}'),
     p_click, p_actions, p_idem)
  on conflict (topic, idempotency_key) do nothing
  returning * into v_msg;

  if v_msg.id is null then
    select * into v_msg
      from public.messages
     where topic = p_topic
       and idempotency_key = p_idem;
  end if;

  return v_msg;
end;
$$;

create or replace function public.list_topics()
returns table (
  topic           text,
  last_seq        bigint,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.topic, max(m.seq), max(m.created_at)
    from public.messages m
   group by m.topic
   order by max(m.seq) desc;
$$;

revoke all on function public.publish_message(text, text, text, smallint, text[], text, jsonb, text)
  from anon, authenticated;
revoke all on function public.list_topics()
  from anon, authenticated;

-- Optional retention. Enable pg_cron in the Supabase dashboard first, then:
-- select cron.schedule(
--   'bellcast-prune',
--   '0 3 * * *',
--   $$delete from public.messages
--      where created_at < now() - interval '30 days'$$
-- );
