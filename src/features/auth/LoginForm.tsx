import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Field, inputClass, PrimaryButton } from "../../components/ui";
import { PasswordInput } from "./PasswordInput";

type Mode = "login" | "signup" | "reset";

const TITLE: Record<Mode, string> = {
  login: "Iniciar sesión",
  signup: "Crear cuenta",
  reset: "Recuperar contraseña",
};

const SUBTITLE: Record<Mode, string> = {
  login: "Para sincronizar tus datos entre dispositivos.",
  signup: "Para sincronizar tus datos entre dispositivos.",
  reset: "Te mandamos un mail con un link para elegir una contraseña nueva.",
};

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    if (mode === "reset") {
      // El link del mail vuelve a esta misma app, que detecta que viene de
      // una recuperación y pide la contraseña nueva (ver useSession).
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setBusy(false);
      if (authError) {
        setError(authError.message);
        return;
      }
      setNotice(
        "Si ese mail tiene una cuenta, te llegó un link para elegir una contraseña nueva. " +
          "Revisá también spam. Abrilo en este mismo navegador o en cualquier otro.",
      );
      return;
    }

    const { error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (mode === "signup") {
      setNotice(
        "Cuenta creada. Si tu proyecto de Supabase pide confirmar el mail, " +
          "revisá tu correo antes de iniciar sesión.",
      );
      setMode("login");
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <Card title={TITLE[mode]} subtitle={SUBTITLE[mode]}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          {mode !== "reset" && (
            <Field label="Contraseña">
              <PasswordInput
                value={password}
                onChange={setPassword}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("reset")}
              className="-mt-2 self-end text-sm text-ink-soft underline-offset-2 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-ink-soft">{notice}</p>}

          <PrimaryButton type="submit" disabled={busy}>
            {busy
              ? "Un momento…"
              : mode === "login"
                ? "Entrar"
                : mode === "signup"
                  ? "Crear cuenta"
                  : "Mandar link"}
          </PrimaryButton>

          <button
            type="button"
            onClick={() => switchMode(mode === "signup" ? "login" : mode === "reset" ? "login" : "signup")}
            className="text-center text-sm text-ink-soft underline-offset-2 hover:underline"
          >
            {mode === "login"
              ? "¿No tenés cuenta? Creá una"
              : mode === "signup"
                ? "¿Ya tenés cuenta? Iniciá sesión"
                : "Volver a iniciar sesión"}
          </button>
        </form>
      </Card>
    </div>
  );
}
