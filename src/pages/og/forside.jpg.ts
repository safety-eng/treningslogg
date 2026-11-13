import type { APIRoute } from 'astro';
import { lagDelingsbilde } from '../../lib/delingsbilde';
import { hentOkter } from '../../lib/data';
import { hero, profil, mal } from '../../data/profil.mjs';

const tall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

export const GET: APIRoute = async () => {
  const okter = await hentOkter();
  const km = okter.filter((o) => o.type === 'lop').reduce((s, o) => s + (o.km ?? 0), 0);
  const jpg = await lagDelingsbilde({
    overlinje: profil.bloggnavn,
    tittel: hero.tittel,
    tall: [
      { navn: 'Kilometer løpt', verdi: tall.format(km) },
      { navn: 'Økter', verdi: String(okter.length) },
    ],
    bunnlinje: `Nå: ${mal.tittel}`,
  });
  return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
};
