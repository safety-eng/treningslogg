// Speiler alle økt-filene i src/content/okter/ til Supabase.
// Repoet er fasiten: databasen tømmes og fylles på nytt i én transaksjon.
//
//   DATABASE_URL=postgres://... node scripts/sync-supabase.mjs   skriver til databasen
//   node scripts/sync-supabase.mjs --sql                         skriver SQL til stdout
//
// Bruk Session pooler-adressen fra Supabase (IPv4), ikke Direct connection.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { flatUt } from '../src/lib/okt-core.mjs';

const MAPPE = path.resolve('src/content/okter');

async function lesInnlegg() {
  const filer = (await readdir(MAPPE)).filter((f) => f.endsWith('.md')).sort();
  const innlegg = [];
  for (const fil of filer) {
    const { data, content } = matter(await readFile(path.join(MAPPE, fil), 'utf8'));
    innlegg.push({ id: fil.replace(/\.md$/, '').toLowerCase(), data, tekst: content.trim() });
  }
  return innlegg;
}

function lagRader(innlegg) {
  const okter = flatUt(innlegg);
  const r = { innlegg: [], okter: [], ovelser: [], sett: [] };
  for (const i of innlegg) {
    r.innlegg.push({
      slug: i.id, dato: i.data.dato, tittel: i.data.tittel, klokkeslett: i.data.klokkeslett ?? null,
      plan_navn: i.data.plan?.navn ?? null, plan_uke: i.data.plan?.uke ?? null, tekst: i.tekst,
    });
  }
  for (const o of okter) {
    r.okter.push({
      id: o.id, innlegg_slug: o.innlegg, nr: o.nr, dato: o.dato, type: o.type, kategori: o.kategori,
      aktivitet: o.aktivitet, distanse_km: o.km, varighet_sek: o.sek, opplevd: o.opplevd,
      planlagt: o.planlagt, kilde: o.kilde,
    });
    for (const ov of o.ovelser) {
      const ovId = `${o.id}-${ov.nr}`;
      r.ovelser.push({ id: ovId, okt_id: o.id, nr: ov.nr, navn: ov.navn });
      for (const s of ov.sett) r.sett.push({ id: `${ovId}-${s.nr}`, ovelse_id: ovId, nr: s.nr, reps: s.reps, kg: s.kg });
    }
  }
  return r;
}

const REKKEFOLGE = ['innlegg', 'okter', 'ovelser', 'sett'];

function bokstavelig(v) {
  if (v == null) return 'null';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function somSql(rader) {
  const linjer = ['begin;', 'delete from public.innlegg;'];
  for (const tabell of REKKEFOLGE) {
    const rows = rader[tabell];
    if (!rows.length) continue;
    const kol = Object.keys(rows[0]);
    linjer.push(`insert into public.${tabell} (${kol.join(', ')}) values`);
    linjer.push(rows.map((row) => `  (${kol.map((k) => bokstavelig(row[k])).join(', ')})`).join(',\n') + ';');
  }
  linjer.push('commit;');
  return linjer.join('\n');
}

const innlegg = await lesInnlegg();
const rader = lagRader(innlegg);

if (process.argv.includes('--sql')) {
  console.log(somSql(rader));
} else if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL mangler, hopper over synk. Legg den inn som secret i GitHub.');
} else {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, ssl: 'require', max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`delete from public.innlegg`;
      for (const tabell of REKKEFOLGE) {
        if (rader[tabell].length) await tx`insert into ${tx('public.' + tabell)} ${tx(rader[tabell])}`;
      }
    });
    console.log(`Synket ${rader.innlegg.length} innlegg, ${rader.okter.length} økter, ${rader.ovelser.length} øvelser, ${rader.sett.length} sett.`);
  } finally {
    await sql.end();
  }
}
