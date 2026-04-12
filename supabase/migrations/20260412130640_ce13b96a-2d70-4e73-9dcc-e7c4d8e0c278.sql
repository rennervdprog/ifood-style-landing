create or replace function public.claim_push_device(
  _fcm_token text default null,
  _player_id text default null,
  _device_info text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _current_user uuid := auth.uid();
begin
  if _current_user is null then
    raise exception 'Unauthorized';
  end if;

  if coalesce(nullif(_fcm_token, ''), nullif(_player_id, '')) is null then
    raise exception 'Device identifier is required';
  end if;

  if nullif(_fcm_token, '') is not null then
    delete from public.fcm_tokens
    where token = _fcm_token
      and user_id <> _current_user;

    insert into public.fcm_tokens (user_id, token, device_info, updated_at)
    values (_current_user, _fcm_token, _device_info, now())
    on conflict (user_id, token)
    do update set
      device_info = excluded.device_info,
      updated_at = now();
  end if;

  if nullif(_player_id, '') is not null then
    delete from public.onesignal_players
    where player_id = _player_id
      and user_id <> _current_user;

    insert into public.onesignal_players (user_id, player_id, device_info, updated_at)
    values (_current_user, _player_id, _device_info, now())
    on conflict (user_id, player_id)
    do update set
      device_info = excluded.device_info,
      updated_at = now();
  end if;
end;
$$;