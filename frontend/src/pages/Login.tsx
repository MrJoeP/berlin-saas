import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Berlin SaaS</CardTitle>
          <CardDescription>10 weeks. 10 AI tools for founders.</CardDescription>
        </CardHeader>
        <CardContent>
          {status === "sent" ? (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--color-fg)] mb-2">
                Magic Link gesendet.
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                Schau in dein Postfach (inkl. Spam) und klick den Link.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <Field hint="Wir schicken dir einen Magic-Link zum direkten Einloggen — kein Passwort nötig.">
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
              {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={status === "sending"}>
                {status === "sending" ? "Sende Link..." : "Magic Link senden"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
