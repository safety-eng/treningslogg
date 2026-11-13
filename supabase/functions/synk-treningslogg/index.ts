// Speiler bloggen til databasen uten hemmeligheter i GitHub:
// henter den åpne filen /data/synk.json fra nettsiden og kaller public.synk_treningslogg().
// Kalles av GitHub Action etter hver publisering og av pg_cron hver time.
// Uten JWT-krav: funksjonen henter bare fra en fast, offentlig adresse, og
// public.synk_treningslogg() gjør ingenting hvis bygget allerede er synket.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import postgres from 'npm:postgres@3.4.5';

// Fast adresse: funksjonen henter aldri data fra en adresse som kommer i forespørselen.
const SIDE = 'https://treningslogg-plum.vercel.app';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ ok: false, feil: 'Bruk POST' }, 405);

  const svar = await fetch(`${SIDE}/data/synk.json`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!svar.ok) return json({ ok: false, feil: `Nettsiden svarte ${svar.status}` }, 502);
  const data = await svar.json();

  try {
    const [rad] = await sql`select public.synk_treningslogg(${sql.json(data)}) as antall`;
    return json({ ok: true, commit: data.commit, generert: data.generert, ...rad.antall });
  } catch (e) {
    return json({ ok: false, feil: e instanceof Error ? e.message : String(e) }, 500);
  }
});
