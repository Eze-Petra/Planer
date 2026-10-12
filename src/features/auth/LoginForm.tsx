import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Field, inputClass, PrimaryButton } from "../../components/ui";

type Mode = "login" | "signup";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);

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
      <Card
        title={mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        subtitle="Para sincronizar tus datos entre dispositivos."
      >
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
          <Field label="Contraseña">
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && <p className="text-sm text-danger">{error}</p>}
          {notice && <p className="text-sm text-ink-soft">{notice}</p>}

          <PrimaryButton type="submit" disabled={busy}>
            {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </PrimaryButton>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setNotice(null);
            }}
            className="text-center text-sm text-ink-soft underline-offset-2 hover:underline"
          >
            {mode === "login"
              ? "¿No tenés cuenta? Creá una"
              : "¿Ya tenés cuenta? Iniciá sesión"}
          </button>
        </form>
      </Card>
    </div>
  );
}
