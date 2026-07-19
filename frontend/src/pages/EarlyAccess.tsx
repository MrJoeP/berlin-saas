import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

// Öffentliche Waitlist-Seite für Testzugänge. Kein Login, schreibt insert-only
// in die waitlist-Tabelle (Migration 035 + 037). Nur E-Mail plus optionale
// Company für die Branchen-Zuordnung. Freigabe erfolgt manuell.

export function EarlyAccess() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "duplicate" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    // Honeypot gefüllt: Bot. Still so tun, als wäre alles gut.
    if (honeypot) {
      setState("done");
      return;
    }
    setState("saving");
    const { error } = await supabase.from("waitlist").insert({
      email: trimmed,
      company: company.trim() || null,
      source: "early-access-page",
    });
    if (!error) {
      setState("done");
    } else if (error.code === "23505") {
      setState("duplicate");
    } else {
      setState("error");
    }
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-accent)]">
            Berlin SaaS
          </div>
          <h1 className="text-3xl font-semibold mt-2 leading-tight">
            10 marketing tools in 10 weeks. Test them early.
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-3 leading-relaxed">
            I build one small marketing tool every week and open a handful of test
            accounts as each one becomes stable. Leave your email and I will send
            you access when a spot opens.
          </p>
        </div>

        {state === "done" || state === "duplicate" ? (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Check className="w-5 h-5 text-emerald-700" />
              </div>
              <p className="text-sm font-medium">
                {state === "duplicate" ? "You are already on the list." : "You are on the list."}
              </p>
              <p className="text-xs text-[var(--color-muted)] mt-2">
                One email when your access is ready. Nothing else.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={submit}>
                {/* Honeypot, für Menschen unsichtbar */}
                <input
                  type="text"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="grid gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="min-w-0 text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company or website (optional)"
                    className="min-w-0 text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                  <Button type="submit" disabled={state === "saving" || !email.trim()}>
                    {state === "saving" ? "Sending..." : "Request access"}
                  </Button>
                </div>
                <p className="text-[11px] text-[var(--color-muted)] mt-2">
                  The company helps me match test access to your industry. Leave it
                  empty if you prefer.
                </p>

                {state === "error" && (
                  <p className="text-xs text-[var(--color-danger)] mt-2">
                    That did not go through. Try again in a minute.
                  </p>
                )}

                <p className="text-[11px] text-[var(--color-muted)] mt-4">
                  No newsletter and no spam. One email when access is ready, and your
                  address is deleted on request.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-[var(--color-muted)] mt-6">
          Built in public. The whole series is on{" "}
          <a
            href="https://www.linkedin.com/in/dario-pilipovic"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            LinkedIn
          </a>
          . Already invited?{" "}
          <a href="/login" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
