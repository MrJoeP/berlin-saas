-- Migration 009a: pg_net Extension
-- Asynchrone HTTP-Calls aus pg_cron, damit der Worker-Tick die Edge Function triggern kann.

create extension if not exists "pg_net";
