-- Migration 001: Extensions
-- Foundation. Vector für Embeddings, pg_cron für Scheduling.

create extension if not exists "vector";
create extension if not exists "pg_cron";
