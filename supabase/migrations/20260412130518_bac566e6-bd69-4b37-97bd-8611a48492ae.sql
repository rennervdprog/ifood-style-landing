with ranked_fcm as (
  select id,
         row_number() over (partition by token order by updated_at desc nulls last, created_at desc nulls last, id desc) as rn
  from public.fcm_tokens
)
delete from public.fcm_tokens t
using ranked_fcm r
where t.id = r.id
  and r.rn > 1;

with ranked_players as (
  select id,
         row_number() over (partition by player_id order by updated_at desc nulls last, created_at desc nulls last, id desc) as rn
  from public.onesignal_players
)
delete from public.onesignal_players p
using ranked_players r
where p.id = r.id
  and r.rn > 1;