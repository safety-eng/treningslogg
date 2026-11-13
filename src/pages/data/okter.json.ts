import type { APIRoute } from 'astro';
import { hentOkter } from '../../lib/data';

export const GET: APIRoute = async () => {
  const okter = await hentOkter();
  return new Response(JSON.stringify({ generert: new Date().toISOString(), okter }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
