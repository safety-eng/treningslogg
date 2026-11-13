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

const tall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
export function formatKm(km: number | null) {
  return km == null ? '–' : `${tall.format(km)} km`;
}
