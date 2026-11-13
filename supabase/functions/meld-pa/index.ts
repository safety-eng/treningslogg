// Påmelding til nyhetsbrevet. Tar imot fornavn, e-post og samtykke fra nettsiden
// og oppretter abonnenten i Buttondown. Buttondown sender selv en bekreftelses-e-post
// (dobbel bekreftelse), og abonnenten får ingenting før lenken i den er klikket.
// Ingenting lagres i vår egen database.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const TILLATT = [
  /^https:\/\/treningslogg-plum\.vercel\.app$/,
  /^https:\/\/treningslogg-[a-z0-9-]+-codebarkdev\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
];

function cors(origin: string | null) {
  const ok = origin && TILLATT.some((r) => r.test(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin! : 'https://treningslogg-plum.vercel.app',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const hoder = { ...cors(origin), 'Content-Type': 'application/json' };
  const svar = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: hoder });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: hoder });
  if (req.method !== 'POST') return svar({ ok: false, feil: 'Bruk POST.' }, 405);

  let inn: Record<string, unknown>;
  try {
    inn = await req.json();
  } catch {
    return svar({ ok: false, feil: 'Ugyldig forespørsel.' }, 400);
  }

  // Honningkrukke: et skjult felt som bare roboter fyller ut.
  if (typeof inn.nettside === 'string' && inn.nettside.trim() !== '') return svar({ ok: true, status: 'bekreft' });

  const fornavn = String(inn.fornavn ?? '').trim().slice(0, 60);
  const epost = String(inn.epost ?? '').trim().toLowerCase();
  if (!fornavn) return svar({ ok: false, felt: 'fornavn', feil: 'Skriv inn fornavnet ditt.' }, 422);
  if (!EPOST.test(epost) || epost.length > 254) return svar({ ok: false, felt: 'epost', feil: 'Sjekk at e-postadressen er riktig.' }, 422);
  if (inn.samtykke !== true) return svar({ ok: false, felt: 'samtykke', feil: 'Du må krysse av for at du vil motta e-post.' }, 422);

  const nokkel = Deno.env.get('BUTTONDOWN_API_KEY');
  if (!nokkel) return svar({ ok: false, feil: 'Påmeldingen er ikke helt klar ennå. Prøv igjen senere.' }, 503);

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || undefined;
  const bd = await fetch('https://api.buttondown.com/v1/subscribers', {
    method: 'POST',
    headers: { 'Authorization': `Token ${nokkel}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email_address: epost,
      metadata: { fornavn, samtykke: 'ja', samtykke_tidspunkt: new Date().toISOString(), samtykke_tekst: 'E-post når det kommer nye innlegg' },
      referrer_url: req.headers.get('Referer') ?? undefined,
      ip_address: ip,
    }),
  });

  if (bd.ok) return svar({ ok: true, status: 'bekreft' });
  const tekst = await bd.text();
  console.log('Buttondown svarte', bd.status, tekst.slice(0, 300));
  if (bd.status === 400 && /already|exists|subscriber_already|email_already/i.test(tekst)) {
    return svar({ ok: true, status: 'finnes' });
  }
  if (bd.status === 400 && /subscriber_suppressed|unsubscribed/i.test(tekst)) {
    return svar({ ok: false, feil: 'Denne adressen er meldt av tidligere. Svar på en tidligere e-post fra nyhetsbrevet hvis du vil melde deg på igjen.' }, 409);
  }
  if (bd.status === 429) return svar({ ok: false, feil: 'Mange påmeldinger akkurat nå. Prøv igjen om litt.' }, 429);
  return svar({ ok: false, feil: 'Noe gikk galt med påmeldingen. Prøv igjen om litt.' }, 502);
});
