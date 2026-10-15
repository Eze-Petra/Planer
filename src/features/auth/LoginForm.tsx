import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Field, inputClass, PrimaryButton } from "../../components/ui";

type Mode = "login" | "signup";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} w-full pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-soft transition-colors hover:text-ink"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="M3 3l18 18" />}
                </svg>
              </button>
            </div>
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
