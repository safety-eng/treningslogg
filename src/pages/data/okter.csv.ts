import type { APIRoute } from 'astro';
import { hentOkter } from '../../lib/data';
import { somCsv } from '../../lib/okt-core.mjs';

export const GET: APIRoute = async ({ site }) => {
  const okter = await hentOkter();
  const base = (site?.href ?? '').replace(/\/$/, '');
  return new Response(somCsv(okter, base), { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
