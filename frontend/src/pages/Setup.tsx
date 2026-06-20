import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { supabase, type Industry, type Source } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field, Textarea } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";

type Step = 1 | 2 | 3 | 4;

interface FormState {
  name: string;
  url: string;
  tagline: string;
  industry: string;
  niche: string;
  keywords: string;
  voice_sample: string;
  competitors: { name: string; url: string }[];
  selected_sources: string[];
}

const initialState: FormState = {
  name: "",
  url: "",
  tagline: "",
  industry: "",
  niche: "",
  keywords: "",
  voice_sample: "",
  competitors: [{ name: "", url: "" }],
  selected_sources: [],
};

// Feste owner-ID für dieses Personal Tool (kein Login).
const OWNER_ID = "00000000-0000-0000-0000-000000000001";

export function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("industries")
      .select("id, name, description")
      .order("name")
      .then(({ data }) => {
        if (data) setIndustries(data as Industry[]);
      });

    supabase
      .from("sources")
      .select("id, name, url, type, industry_tags, is_default")
      .then(({ data }) => {
        if (data) setSources(data as Source[]);
      });
  }, []);

  const filteredSources = sources.filter(
    (s) => form.industry === "" || s.industry_tags.includes(form.industry),
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addCompetitor() {
    update("competitors", [...form.competitors, { name: "", url: "" }]);
  }

  function removeCompetitor(idx: number) {
    update(
      "competitors",
      form.competitors.filter((_, i) => i !== idx),
    );
  }

  function updateCompetitor(idx: number, field: "name" | "url", value: string) {
    const updated = [...form.competitors];
    updated[idx] = { ...updated[idx], [field]: value };
    update("competitors", updated);
  }

  function toggleSource(id: string) {
    if (form.selected_sources.includes(id)) {
      update(
        "selected_sources",
        form.selected_sources.filter((s) => s !== id),
      );
    } else {
      update("selected_sources", [...form.selected_sources, id]);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({
          user_id: OWNER_ID,
          name: form.name,
          url: form.url || null,
          tagline: form.tagline || null,
          industry: form.industry || null,
          niche: form.niche || null,
          keywords: form.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          voice_sample: form.voice_sample || null,
        })
        .select()
        .single();

      if (companyErr) throw companyErr;
      if (!company) throw new Error("Keine Company-ID zurück.");

      const competitorsToInsert = form.competitors
        .filter((c) => c.name.trim())
        .map((c) => ({ company_id: company.id, name: c.name, url: c.url || null }));

      if (competitorsToInsert.length > 0) {
        const { error: compErr } = await supabase.from("competitors").insert(competitorsToInsert);
        if (compErr) throw compErr;
      }

      if (form.selected_sources.length > 0) {
        const sourcesToInsert = form.selected_sources.map((sid) => ({
          company_id: company.id,
          source_id: sid,
          active: true,
        }));
        const { error: srcErr } = await supabase.from("company_sources").insert(sourcesToInsert);
        if (srcErr) throw srcErr;
      }

      // Job für initiales Scrape enqueuen.
      const { error: jobErr } = await supabase.from("jobs").insert({
        type: "scrape_company",
        company_id: company.id,
      });
      if (jobErr) throw jobErr;

      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Setup</h1>
          <p className="text-sm text-[var(--color-muted)]">Schritt {step} von 4</p>
        </div>

        <Card>
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Deine Firma</CardTitle>
                <CardDescription>Die Basis. Drei Felder, alle kurz.</CardDescription>
              </CardHeader>
              <CardContent>
                <Field>
                  <Label htmlFor="name" required>Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="z.B. Acme Labs"
                    required
                  />
                </Field>
                <Field hint="Wir scrapen die Seite für Profile-Extraction.">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={form.url}
                    onChange={(e) => update("url", e.target.value)}
                    placeholder="https://acme.com"
                  />
                </Field>
                <Field>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={form.tagline}
                    onChange={(e) => update("tagline", e.target.value)}
                    placeholder="One-Liner. Was macht ihr."
                  />
                </Field>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!form.name}>
                  Weiter
                </Button>
              </CardFooter>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Industrie und Keywords</CardTitle>
                <CardDescription>Bestimmt welche Sources matchen.</CardDescription>
              </CardHeader>
              <CardContent>
                <Field>
                  <Label htmlFor="industry">Industrie</Label>
                  <select
                    id="industry"
                    value={form.industry}
                    onChange={(e) => update("industry", e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-[var(--color-border)] bg-white text-sm"
                  >
                    <option value="">Wählen...</option>
                    {industries.map((i) => (
                      <option key={i.id} value={i.name}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field>
                  <Label htmlFor="niche">Nische</Label>
                  <Input
                    id="niche"
                    value={form.niche}
                    onChange={(e) => update("niche", e.target.value)}
                    placeholder="z.B. HR-Tech für Mittelstand DACH"
                  />
                </Field>
                <Field hint="Komma-getrennt, 3 bis 8 Begriffe.">
                  <Label htmlFor="keywords">Keywords</Label>
                  <Input
                    id="keywords"
                    value={form.keywords}
                    onChange={(e) => update("keywords", e.target.value)}
                    placeholder="recruiting automation, ATS, employer branding"
                  />
                </Field>
                <Field hint="Optional. Wenige Sätze, die deine Voice zeigen.">
                  <Label htmlFor="voice">Voice-Sample</Label>
                  <Textarea
                    id="voice"
                    value={form.voice_sample}
                    onChange={(e) => update("voice_sample", e.target.value)}
                    placeholder="Wir schreiben direkt, ohne Buzzwords..."
                  />
                </Field>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>Zurück</Button>
                <Button onClick={() => setStep(3)}>Weiter</Button>
              </CardFooter>
            </>
          )}

          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle>Konkurrenten</CardTitle>
                <CardDescription>3 bis 5 namentlich. Bot scraped sie automatisch.</CardDescription>
              </CardHeader>
              <CardContent>
                {form.competitors.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-3 mb-3 items-end">
                    <div>
                      <Label htmlFor={`comp-name-${idx}`}>Name</Label>
                      <Input
                        id={`comp-name-${idx}`}
                        value={c.name}
                        onChange={(e) => updateCompetitor(idx, "name", e.target.value)}
                        placeholder="Konkurrent X"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`comp-url-${idx}`}>URL</Label>
                      <Input
                        id={`comp-url-${idx}`}
                        type="url"
                        value={c.url}
                        onChange={(e) => updateCompetitor(idx, "url", e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCompetitor(idx)}
                      disabled={form.competitors.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={addCompetitor}>
                  <Plus className="w-4 h-4 mr-1" />
                  Konkurrent hinzufügen
                </Button>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(2)}>Zurück</Button>
                <Button onClick={() => setStep(4)}>Weiter</Button>
              </CardFooter>
            </>
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>Sources</CardTitle>
                <CardDescription>
                  {filteredSources.length === 0
                    ? "Noch keine Sources in deiner Industrie. Du kannst sie später hinzufügen."
                    : "Wähle aus, was der Bot wöchentlich scraped."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSources.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    Beim ersten Setup einer Industrie ist die Source-Liste noch leer.
                    Source-Library wird befüllt, sobald die ersten Quellen eingetragen sind.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredSources.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-start gap-3 p-3 rounded-md border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg)]"
                      >
                        <input
                          type="checkbox"
                          checked={form.selected_sources.includes(s.id)}
                          onChange={() => toggleSource(s.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{s.name}</div>
                          <div className="text-xs text-[var(--color-muted)]">
                            {s.type} {s.url && `· ${s.url}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {error && (
                  <p className="text-xs text-[var(--color-danger)] mt-4">{error}</p>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(3)}>Zurück</Button>
                <Button onClick={onSubmit} disabled={submitting}>
                  {submitting ? "Speichere..." : "Setup abschließen"}
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
