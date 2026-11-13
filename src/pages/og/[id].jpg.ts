import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { lagDelingsbilde } from '../../lib/delingsbilde';
import { formatDatoMedUkedag } from '../../lib/data';
import { parseVarighet, formatKlokke, formatTempo } from '../../lib/okt-core.mjs';
import { profil } from '../../data/profil.mjs';

export const getStaticPaths: GetStaticPaths = async () =>
  (await getCollection('okter')).map((entry) => ({ params: { id: entry.id }, props: { entry } }));

const tall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const GET: APIRoute = async ({ props }) => {
  const d = (props as any).entry.data;
  const o = d.okter[0];
  const sek = parseVarighet(o.varighet);
  let nokkeltall: { navn: string; verdi: string }[];
  if (o.type === 'lop') {
    nokkeltall = [
      { navn: 'Distanse', verdi: `${tall.format(o.distanse_km)} km` },
      { navn: 'Tid', verdi: formatKlokke(sek) },
      { navn: 'Tempo', verdi: `${formatTempo((sek ?? 0) / o.distanse_km)} /km` },
    ];
  } else if (o.type === 'styrke') {
    nokkeltall = [
      { navn: 'Økt', verdi: 'Styrke' },
      { navn: 'Øvelser', verdi: String(o.ovelser.length) },
      ...(sek ? [{ navn: 'Tid', verdi: formatKlokke(sek) }] : []),
    ];
  } else {
    nokkeltall = [
      { navn: 'Økt', verdi: stor(o.aktivitet) },
      ...(o.distanse_km ? [{ navn: 'Distanse', verdi: `${tall.format(o.distanse_km)} km` }] : []),
      ...(sek ? [{ navn: 'Tid', verdi: formatKlokke(sek) }] : []),
    ];
  }
  if (d.okter.length > 1) nokkeltall = nokkeltall.slice(0, 2).concat({ navn: 'Økter', verdi: String(d.okter.length) });

  const jpg = await lagDelingsbilde({
    overlinje: `${profil.bloggnavn}, ${formatDatoMedUkedag(d.dato).toLowerCase()}`,
    tittel: d.tittel,
    tall: nokkeltall,
    bunnlinje: d.plan ? `Uke ${d.plan.uke} i «${d.plan.navn}»` : undefined,
  });
  return new Response(jpg, { headers: { 'Content-Type': 'image/jpeg' } });
};
