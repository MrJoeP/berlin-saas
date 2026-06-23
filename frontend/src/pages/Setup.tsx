import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { normalizeDomain } from "@/lib/domain";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ") || JSON.stringify(err);
  }
  return String(err);
}

// Initial-Name aus URL ableiten — wird vom Bot durch echten Firmen-Namen ersetzt.
function nameFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return rawUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

export function Setup() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session?.user.id) {
      setError("Keine aktive Session. Bitte einloggen.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      // Dedup-Vorprüfung: existiert für dieses Konto schon eine Firma mit derselben Domain?
      // RLS scoped die Abfrage automatisch auf die eigenen Firmen.
      const domain = normalizeDomain(url);
      const { data: existing } = await supabase.from("companies").select("id, url, name");
      const match = (existing ?? []).find(
        (c) => c.url && normalizeDomain(c.url) === domain,
      );
      if (match) {
        setError(
          `„${match.name ?? domain}" ist für dieses Konto bereits angelegt. Wir öffnen die bestehende Firma statt einer Dublette.`,
        );
        setTimeout(() => navigate("/"), 1500);
        return;
      }

      const initialName = nameFromUrl(url);
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({ user_id: session.user.id, name: initialName, url, keywords: [] })
        .select()
        .single();

      if (companyErr) throw companyErr;
      if (!company) throw new Error("Keine Company-ID zurück.");

      const { error: jobErr } = await supabase.from("jobs").insert({
        type: "scrape_company",
        company_id: company.id,
      });
      if (jobErr) throw jobErr;

      navigate("/");
    } catch (err) {
      setError(extractErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-12 flex items-start justify-center">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
            <CardDescription>
              Nur die Website-URL. Der Bot extrahiert Name, Industrie, Niche, Keywords und stößt den ersten Digest an.
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent>
              <Field hint="Z.B. https://buzzmatic.net — alles weitere übernimmt der Bot.">
                <Label htmlFor="url" required>Website-URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://acme.com"
                  required
                  autoFocus
                />
              </Field>

              {error && (
                <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={submitting || !url}>
                {submitting ? "Starte..." : "Los geht's"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-xs text-[var(--color-muted)] text-center mt-4">
          Konkurrenten und einzelne Sources kannst du später im Dashboard ergänzen.
        </p>
      </div>
    </div>
  );
}
