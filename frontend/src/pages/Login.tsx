import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError(null);

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setStatus("error");
        setError(signInError.message);
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setStatus("error");
        setError(signUpError.message);
      } else {
        setMode("login");
        setStatus("idle");
        setError("Account erstellt. Jetzt einloggen.");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Berlin SaaS</CardTitle>
          <CardDescription>10 weeks. 10 AI tools for founders.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field>
              <Label htmlFor="email" required>Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@deinedomain.com"
                required
                autoFocus
              />
            </Field>

            <Field>
              <Label htmlFor="password" required>Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </Field>

            {error && (
              <p className="text-xs text-[var(--color-danger)]">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={status === "loading"}>
              {status === "loading"
                ? "..."
                : mode === "login"
                ? "Einloggen"
                : "Account erstellen"}
            </Button>

            <p className="text-xs text-center text-[var(--color-muted)]">
              {mode === "login" ? (
                <>Noch kein Account?{" "}
                  <button type="button" onClick={() => { setMode("signup"); setError(null); }} className="underline">
                    Registrieren
                  </button>
                </>
              ) : (
                <>Bereits registriert?{" "}
                  <button type="button" onClick={() => { setMode("login"); setError(null); }} className="underline">
                    Einloggen
                  </button>
                </>
              )}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
