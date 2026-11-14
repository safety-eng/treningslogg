// Speiler bloggen til databasen uten hemmeligheter i GitHub:
// henter den åpne filen /data/synk.json fra nettsiden og kaller public.synk_treningslogg().
// Kalles av GitHub Action etter hver publisering og av pg_cron hver time.
// Uten JWT-krav: funksjonen henter bare fra en fast, offentlig adresse, og
// public.synk_treningslogg() gjør ingenting hvis bygget allerede er synket.
//
// Nyhetsbrev: nye innlegg (siste 7 dager) som ikke står i nyhetsbrev_sendt, sendes
// til abonnentene via Buttondown. Krever secret BUTTONDOWN_API_KEY.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import postgres from 'npm:postgres@3.4.5';

// Fast adresse: funksjonen henter aldri data fra en adresse som kommer i forespørselen.
const SIDE = 'https://treningslogg-plum.vercel.app';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

// ---------- formatering ----------
const tall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
const datoFmt = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function klokke(sek: number) {
  const t = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = Math.round(sek % 60);
  return (t ? `${t}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
}
function tempo(sekPerKm: number) {
  let m = Math.floor(sekPerKm / 60), s = Math.round(sekPerKm - m * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Innlegg = { slug: string; dato: string; tittel: string; tekst: string; plan_navn: string | null; plan_uke: number | null };
type Okt = { innlegg_slug: string; nr: number; type: string; aktivitet: string | null; distanse_km: number | null; varighet_sek: number | null };
type Ovelse = { okt_id: string };

function oktLinje(o: Okt, antallOvelser: number) {
  const tid = o.varighet_sek ? klokke(o.varighet_sek) : null;
  if (o.type === 'lop' && o.distanse_km && o.varighet_sek) {
    return `${tall.format(o.distanse_km)} km på ${tid} (${tempo(o.varighet_sek / o.distanse_km)} /km)`;
  }
  if (o.type === 'styrke') return `Styrke, ${antallOvelser} ${antallOvelser === 1 ? 'øvelse' : 'øvelser'}${tid ? `, ${tid}` : ''}`;
  return `${stor(o.aktivitet ?? 'Annet')}${o.distanse_km ? `, ${tall.format(o.distanse_km)} km` : ''}${tid ? `, ${tid}` : ''}`;
}

function lagEpost(i: Innlegg, okter: Okt[], ovelser: Ovelse[]) {
  const lenke = `${SIDE}/okter/${i.slug}/`;
  const dato = stor(datoFmt.format(new Date(`${i.dato}T00:00:00Z`)));
  const plan = i.plan_navn && i.plan_uke ? `, uke ${i.plan_uke} i «${i.plan_navn}»` : '';
  const linjer = okter
    .filter((o) => o.innlegg_slug === i.slug)
    .sort((a, b) => a.nr - b.nr)
    .map((o) => `- ${oktLinje(o, ovelser.filter((v) => v.okt_id === `${o.innlegg_slug}-${o.nr}`).length)}`);
  return [
    `[![${i.tittel}](${SIDE}/og/${i.slug}.jpg)](${lenke})`,
    '',
    `**${dato}**${plan}`,
    '',
    ...linjer,
    '',
    i.tekst,
    '',
    `[Se innlegget og statistikken på nettsiden](${lenke})`,
  ].join('\n');
}

async function sendNyeInnlegg(data: { innlegg: Innlegg[]; okter: Okt[]; ovelser: Ovelse[] }) {
  const nokkel = Deno.env.get('BUTTONDOWN_API_KEY');
  if (!nokkel) return { sendt: [], merknad: 'BUTTONDOWN_API_KEY er ikke satt' };

  const grense = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const kandidater = data.innlegg.filter((i) => i.dato >= grense).sort((a, b) => (a.dato < b.dato ? -1 : 1));
  if (!kandidater.length) return { sendt: [] };

  const allerede = new Set(
    (await sql`select slug from public.nyhetsbrev_sendt where slug = any(${kandidater.map((i) => i.slug)})`).map((r) => r.slug),
  );
  const sendt: string[] = [];
  const feil: string[] = [];
  for (const i of kandidater.filter((k) => !allerede.has(k.slug))) {
    // Reserver først, så to samtidige kjøringer aldri sender samme innlegg.
    const reservert = await sql`insert into public.nyhetsbrev_sendt (slug, status) values (${i.slug}, 'sendt') on conflict do nothing returning slug`;
    if (!reservert.length) continue;
    try {
      const r = await fetch('https://api.buttondown.com/v1/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${nokkel}`,
          'Content-Type': 'application/json',
          'X-API-Version': '2026-04-01',
          // Buttondown krever denne for å sende direkte via API (bekreftelse på at automatisk utsending er ønsket).
          'X-Buttondown-Live-Dangerously': 'true',
        },
        body: JSON.stringify({ subject: i.tittel, body: lagEpost(i, data.okter, data.ovelser), status: 'about_to_send' }),
      });
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      const epost = await r.json().catch(() => ({}));
      await sql`update public.nyhetsbrev_sendt set buttondown_id = ${epost?.id ?? null} where slug = ${i.slug}`;
      sendt.push(i.slug);
    } catch (e) {
      // Fjern reservasjonen, så neste kjøring prøver igjen.
      await sql`delete from public.nyhetsbrev_sendt where slug = ${i.slug}`;
      feil.push(`${i.slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (feil.length) console.log('Nyhetsbrev feilet', feil);
  return { sendt, feil };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return json({ ok: false, feil: 'Bruk POST' }, 405);

  const svar = await fetch(`${SIDE}/data/synk.json`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!svar.ok) return json({ ok: false, feil: `Nettsiden svarte ${svar.status}` }, 502);
  const data = await svar.json();

  try {
    const [rad] = await sql`select public.synk_treningslogg(${sql.json(data)}) as antall`;
    const nyhetsbrev = await sendNyeInnlegg(data);
    return json({ ok: true, commit: data.commit, generert: data.generert, ...rad.antall, nyhetsbrev });
  } catch (e) {
    return json({ ok: false, feil: e instanceof Error ? e.message : String(e) }, 500);
  }
});
