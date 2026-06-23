import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { AuthContext } from "./auth-context";

// Wird nach Sign-In aufgerufen: hängt orphaned companies (user_id NULL) an den
// neuen User. Praktisch für Migration der bestehenden Testdaten beim ersten Login.
// RLS blockiert ungeclaimte Reihen — daher mit service_role-artigem SQL via RPC wäre
// sauberer; für jetzt: Update wird durch companies_own Policy gefiltert wenn user_id
// schon gesetzt ist, daher kein Risiko fremde Companies zu kapern.
async function claimOrphanedCompanies(userId: string) {
  await supabase
    .from("companies")
    .update({ user_id: userId })
    .is("user_id", null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);
      if (event === "SIGNED_IN" && session?.user.id) {
        // Beim Login: orphaned companies (user_id NULL) dem User zuweisen.
        claimOrphanedCompanies(session.user.id).catch(console.error);
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
