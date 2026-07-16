import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

// Öffentliche Waitlist-Seite für Testzugänge. Kein Login, schreibt insert-only
// in die waitlist-Tabelle (Migration 035). Freigabe erfolgt manuell.

const TOOLS = [
  {
    key: "niche_news",
    name: "Niche News Digest",
    blurb: "Reads your industry news and turns it into one weekly briefing.",
  },
  {
    key: "social_digest",
    name: "Social Media Digest",
    blurb: "Reads Reddit, Hacker News, X, LinkedIn, YouTube and Product Hunt for you.",
  },
  {
    key: "market_radar",
    name: "Market Radar",
    blurb: "Watches competitors, alternatives and complements, including pricing page changes.",
  },
];

export function EarlyAccess() {
  const [email, setEmail] = useState("");
  const [picked, setPicked] = useState<string[]>(TOOLS.map((t) => t.key));
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "duplicate" | "error">("idle");

  function toggleTool(key: string) {
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

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
      tools: picked.length > 0 ? picked : TOOLS.map((t) => t.key),
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
            accounts as each one becomes stable. Leave your email, pick what
            interests you, and I will send you access when a spot opens.
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
                <div className="grid gap-2 mb-5">
                  {TOOLS.map((tool) => {
                    const active = picked.includes(tool.key);
                    return (
                      <button
                        key={tool.key}
                        type="button"
                        onClick={() => toggleTool(tool.key)}
                        className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                          active
                            ? "border-[var(--color-accent)] bg-blue-50"
                            : "border-[var(--color-border)] hover:bg-[var(--color-bg)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              active
                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                : "border-[var(--color-border)] bg-white"
                            }`}
                          >
                            {active && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="text-sm font-medium">{tool.name}</span>
                        </div>
                        <p className="text-xs text-[var(--color-muted)] mt-1 ml-6">{tool.blurb}</p>
                      </button>
                    );
                  })}
                </div>

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

                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="min-w-0 flex-1 text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                  <Button type="submit" disabled={state === "saving" || !email.trim()}>
                    {state === "saving" ? "Sending..." : "Request access"}
                  </Button>
                </div>

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
          .
        </p>
      </div>
    </div>
  );
}
