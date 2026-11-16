import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { Card, Field, inputClass, PrimaryButton } from "../../components/ui";
import { PasswordInput } from "./PasswordInput";

/**
 * Formulario para elegir una contraseña nueva estando logueado. Se usa al
 * entrar desde el link de recuperación del mail y desde la barra de usuario.
 */
export function ChangePasswordForm(props: {
  title: string;
  subtitle: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password !== repeat) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    props.onDone();
  };

  return (
    <Card title={props.title} subtitle={props.subtitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Contraseña nueva">
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
        </Field>
        <Field label="Repetir contraseña">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
            className={inputClass}
          />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Un momento…" : "Guardar contraseña"}
        </PrimaryButton>
        {props.onCancel && (
          <button
            type="button"
            onClick={props.onCancel}
            className="text-center text-sm text-ink-soft underline-offset-2 hover:underline"
          >
            Cancelar
          </button>
        )}
      </form>
    </Card>
  );
}
