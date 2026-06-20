import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

export function Setup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({ name, url: url || null, keywords: [] })
        .select()
        .single();

      if (companyErr) throw companyErr;
      if (!company) throw new Error("Keine Company-ID zurück.");

      // Bot übernimmt: scraped Website, klassifiziert Industrie, picked Sources,
      // stößt den ersten News-Digest automatisch an.
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
              Name und URL. Der Bot scraped, klassifiziert die Industrie und stößt den ersten Digest an.
            </CardDescription>
          </CardHeader>
          <form onSubmit={onSubmit}>
            <CardContent>
              <Field>
                <Label htmlFor="name" required>Firmen-Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Acme Labs"
                  required
                  autoFocus
                />
              </Field>
              <Field hint="Der Bot extrahiert Profil, Niche und Keywords daraus.">
                <Label htmlFor="url" required>Website-URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://acme.com"
                  required
                />
              </Field>

              {error && (
                <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={submitting || !name || !url}>
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
