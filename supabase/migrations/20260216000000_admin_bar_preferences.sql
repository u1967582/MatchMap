-- Migration: Admin Bar Preferences
-- Description: Allows super admins to sync bar preferences for any bar

-- Function to check if user is super admin
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select u.is_super_user
     from public.users u
     where u.id = auth.uid()),
    false
  );
$$;

-- Function to sync bar preferences for admins
create or replace function public.fn_sync_bar_preferences_admin(
  _bar_id text,
  _competition_ids text[],
  _team_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check if user is super admin
  if not is_super_admin() then
    raise exception 'Only super admins can use this function';
  end if;

  -- Delete existing preferences
  delete from public.bar_selected_competitions where bar_id = _bar_id;
  delete from public.bar_selected_teams where bar_id = _bar_id;

  -- Insert new competition preferences
  if array_length(_competition_ids, 1) > 0 then
    insert into public.bar_selected_competitions (bar_id, competition_id)
    select _bar_id, unnest(_competition_ids)::uuid;
  end if;

  -- Insert new team preferences
  if array_length(_team_ids, 1) > 0 then
    insert into public.bar_selected_teams (bar_id, team_id)
    select _bar_id, unnest(_team_ids)::uuid;
  end if;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.fn_sync_bar_preferences_admin(text, text[], text[]) to authenticated;
