-- user_id nicht mehr an auth.users gebunden (kein Login mehr).
alter table companies drop constraint if exists companies_user_id_fkey;
alter table companies alter column user_id drop not null;
