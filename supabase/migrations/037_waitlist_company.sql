-- Migration 037: Company-Feld für die Waitlist. Optional, dient der
-- Branchen-Zuordnung bei der Freigabe von Testzugängen.

alter table waitlist add column if not exists company text;
