create table if not exists public.api_rate_limits (
  scope text not null,
  identifier_hash text not null,
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  request_count integer not null,
  primary key (scope, identifier_hash),
  constraint api_rate_limits_scope_check
    check (scope ~ '^[a-z0-9:_-]{1,80}$'),
  constraint api_rate_limits_identifier_hash_check
    check (identifier_hash ~ '^[0-9a-f]{64}$'),
  constraint api_rate_limits_request_count_check
    check (request_count > 0),
  constraint api_rate_limits_window_check
    check (expires_at > window_started_at)
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated, service_role;

create index if not exists api_rate_limits_expires_at_idx
  on public.api_rate_limits (expires_at);

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_expiry timestamptz;
begin
  if p_scope !~ '^[a-z0-9:_-]{1,80}$'
    or p_identifier_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid rate limit arguments.';
  end if;

  insert into public.api_rate_limits as bucket (
    scope,
    identifier_hash,
    window_started_at,
    expires_at,
    request_count
  )
  values (
    p_scope,
    p_identifier_hash,
    v_now,
    v_now + make_interval(secs => p_window_seconds),
    1
  )
  on conflict (scope, identifier_hash) do update
  set
    window_started_at = case
      when bucket.expires_at <= v_now then excluded.window_started_at
      else bucket.window_started_at
    end,
    expires_at = case
      when bucket.expires_at <= v_now then excluded.expires_at
      else bucket.expires_at
    end,
    request_count = case
      when bucket.expires_at <= v_now then 1
      else least(bucket.request_count + 1, p_limit + 1)
    end
  where bucket.expires_at <= v_now
    or bucket.request_count <= p_limit
  returning bucket.request_count, bucket.expires_at
  into v_count, v_expiry;

  if not found then
    select request_count, expires_at
    from public.api_rate_limits
    where scope = p_scope
      and identifier_hash = p_identifier_hash
    into v_count, v_expiry;
  end if;

  if random() < 0.01 then
    if pg_try_advisory_xact_lock(hashtextextended('api_rate_limits_cleanup', 0)) then
      with expired_buckets as (
        select scope, identifier_hash
        from public.api_rate_limits
        where expires_at < v_now - interval '1 day'
        order by expires_at
        limit 100
        for update skip locked
      )
      delete from public.api_rate_limits as stale
      using expired_buckets
      where stale.scope = expired_buckets.scope
        and stale.identifier_hash = expired_buckets.identifier_hash
        and stale.expires_at < v_now - interval '1 day';
    end if;
  end if;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    case
      when v_count <= p_limit then 0
      else greatest(1, ceil(extract(epoch from (v_expiry - v_now)))::integer)
    end;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer) to service_role;

comment on table public.api_rate_limits is
  'Durable fixed-window API rate-limit buckets. Identifier hashes are keyed HMACs; raw client IP addresses are never stored.';

comment on function public.consume_api_rate_limit(text, text, integer, integer) is
  'Atomically consumes one request from a fixed-window rate-limit bucket.';
