import { getCollection } from 'astro:content';
import { flatUt } from './okt-core.mjs';

export async function hentInnlegg() {
  const innlegg = await getCollection('okter');
  return innlegg.sort((a, b) => (a.data.dato < b.data.dato ? 1 : -1));
}

export async function hentOkter() {
  const innlegg = await getCollection('okter');
  return flatUt(innlegg.map((i) => ({ id: i.id, data: i.data })));
}

const datoFormat = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export function formatDato(iso: string) {
  return datoFormat.format(new Date(`${iso}T00:00:00Z`));
}

const ukedagFormat = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "Onsdag 11. november 2026" */
export function formatDatoMedUkedag(iso: string) {
  const t = ukedagFormat.format(new Date(`${iso}T00:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Første avsnitt av innlegget som ren tekst, kuttet ved et helt ord. */
export function utdrag(markdown: string | undefined, maks = 170) {
  const forste = (markdown ?? '').trim().split(/\n\s*\n/)[0] ?? '';
  const ren = forste.replace(/[*_`>#\[\]]/g, '').replace(/\((https?:[^)]+)\)/g, '').replace(/\s+/g, ' ').trim();
  if (ren.length <= maks) return ren;
  const kutt = ren.slice(0, maks);
  return kutt.slice(0, kutt.lastIndexOf(' ')).replace(/[,.;:]$/, '') + '…';
}

const tall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
export function formatKm(km: number | null) {
  return km == null ? '–' : `${tall.format(km)} km`;
}
