import { supabase } from "./supabase";

// Invite-Gate: Login ist offen (Google + Magic Link), aber die Tools gibt es
// erst mit Freischaltung (waitlist.status invited/active) oder als Admin.
// Server-seitig erzwungen über die companies-Insert-Policy (Migration 038),
// hier nur die UX-Seite davon.

export const ADMIN_EMAILS = ["dariopilipovic01@gmail.com", "dariopilipovic@web.de"];

export type InviteAccess = "admin" | "invited" | "not_invited";

export async function checkInviteAccess(email: string | null | undefined): Promise<InviteAccess> {
  const mail = (email ?? "").toLowerCase();
  if (!mail) return "not_invited";
  if (ADMIN_EMAILS.includes(mail)) return "admin";
  // RLS erlaubt nur die eigene Zeile, die Abfrage kann also nichts leaken.
  const { data } = await supabase
    .from("waitlist")
    .select("status")
    .ilike("email", mail)
    .maybeSingle();
  if (data && (data.status === "invited" || data.status === "active")) return "invited";
  return "not_invited";
}
