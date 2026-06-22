import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input, Label, Field } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "google">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onMagicLinkSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  async function onGoogleSignIn() {
    setStatus("google");
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) {
      setStatus("error");
      setError(oauthError.message);
    }
    // Bei Erfolg redirected Supabase die ganze Seite zu Google. Kein weiterer Handler nötig.
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
              <p className="text-sm text-[var(--color-fg)] mb-2">Magic Link gesendet.</p>
              <p className="text-xs text-[var(--color-muted)]">Schau in dein Postfach (inkl. Spam) und klick den Link.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={onGoogleSignIn}
                disabled={status === "google"}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {status === "google" ? "Weiterleitung zu Google..." : "Mit Google einloggen"}
              </Button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-muted)]">oder</span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>

              <form onSubmit={onMagicLinkSubmit} className="space-y-3">
                <Field hint="Magic Link per Email (langsamer, aber kein OAuth-Setup nötig).">
                  <Label htmlFor="email" required>Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="du@deinedomain.com"
                    required
                  />
                </Field>
                <Button type="submit" variant="ghost" size="md" className="w-full" disabled={status === "sending"}>
                  {status === "sending" ? "Sende Link..." : "Magic Link senden"}
                </Button>
              </form>

              {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
