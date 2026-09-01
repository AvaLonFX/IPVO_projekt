alter table public."UserDreamTeams" drop constraint dream_team_active_valid;
alter table public."UserDreamTeams" add constraint dream_team_active_valid check
  (archived_at is not null or (user_id is not null and player_id is not null and position is not null and position > 0));
