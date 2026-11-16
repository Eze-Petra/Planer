/**
 * Keep-alive de Supabase: el plan gratis pausa el proyecto después de
 * ~1 semana sin actividad. Vercel Cron (ver `vercel.json`) llama a esta
 * función una vez por día y hace una consulta real a la base para que
 * cuente como uso.
 *
 * Usa la misma anon/publishable key que el front: por Row Level Security la
 * consulta devuelve vacío, pero igual llega a Postgres, que es lo que importa.
 */
export async function GET() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json(
      { ok: false, error: "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${url}/rest/v1/planner_state?select=user_id&limit=1`, {
      headers: { apikey: key },
    });
    return Response.json({ ok: res.ok, status: res.status }, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
