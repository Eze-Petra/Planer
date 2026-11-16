import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { openedFromRecoveryLink, supabase } from "../../lib/supabase";

/**
 * Sesión actual de Supabase Auth, reactiva a login/logout/refresh de token.
 *
 * `recovering` es true cuando se entró con el link de "olvidé mi contraseña":
 * el link ya deja la sesión iniciada, pero hay que pedir la contraseña nueva.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(openedFromRecoveryLink);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return { session, loading, recovering, finishRecovery: () => setRecovering(false) };
}
