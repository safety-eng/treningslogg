import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { lagRader } from '../../lib/okt-core.mjs';

// Alt Supabase trenger for å speile bloggen. Hentes av Edge-funksjonen synk-treningslogg.
export const GET: APIRoute = async () => {
  const innlegg = await getCollection('okter');
  const rader = lagRader(innlegg.map((i) => ({ id: i.id, data: i.data, tekst: (i.body ?? '').trim() })));
  const kropp = {
    generert: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ...rader,
  };
  return new Response(JSON.stringify(kropp), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
