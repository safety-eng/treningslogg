// Manuell synk av økt-filene til Supabase (vanligvis trengs den ikke:
// Supabase-funksjonen synk-treningslogg henter /data/synk.json fra nettsiden selv).
//
//   node scripts/sync-supabase.mjs --sql                         skriver SQL til stdout
//   DATABASE_URL=postgres://... node scripts/sync-supabase.mjs   skriver direkte til databasen
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { lagRader } from '../src/lib/okt-core.mjs';

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
  console.log('DATABASE_URL mangler. Bruk --sql, eller la Supabase-funksjonen synke fra nettsiden.');
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
