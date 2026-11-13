import type { APIRoute } from 'astro';
import ExcelJS from 'exceljs';
import { hentOkter } from '../../lib/data';
import { TYPE_NAVN, KATEGORI_NAVN } from '../../lib/okt-core.mjs';
import { profil } from '../../data/profil.mjs';

// Excel-fil med ekte tall og tider, så besøkende kan regne videre selv.
const DAG = 86400;
const excelDato = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / (DAG * 1000);
};
const mandag = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const isoUke = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return { ar: d.getUTCFullYear(), uke: 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7) };
};
const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function stilHode(ark: ExcelJS.Worksheet) {
  const rad = ark.getRow(1);
  rad.font = { bold: true };
  rad.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E8E6' } };
  rad.alignment = { vertical: 'middle' };
  rad.height = 20;
  ark.views = [{ state: 'frozen', ySplit: 1 }];
  ark.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ark.columnCount } };
}

export const GET: APIRoute = async ({ site }) => {
  const okter = await hentOkter();
  const base = (site?.href ?? '').replace(/\/$/, '');
  const bok = new ExcelJS.Workbook();
  bok.creator = profil.bloggnavn;
  bok.created = new Date();

  // ---- Økter: én rad per økt ----
  const ark = bok.addWorksheet('Økter');
  ark.columns = [
    { header: 'Dato', key: 'dato', width: 12, style: { numFmt: 'dd.mm.yyyy' } },
    { header: 'Innlegg', key: 'tittel', width: 38 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Kategori / aktivitet', key: 'kategori', width: 20 },
    { header: 'Distanse (km)', key: 'km', width: 14, style: { numFmt: '0.00' } },
    { header: 'Tid', key: 'tid', width: 11, style: { numFmt: '[h]:mm:ss' } },
    { header: 'Tempo (min/km)', key: 'tempo', width: 15, style: { numFmt: 'm:ss' } },
    { header: 'Opplevd', key: 'opplevd', width: 11 },
    { header: 'Planlagt', key: 'planlagt', width: 44 },
    { header: 'Uke i plan', key: 'uke', width: 11 },
    { header: 'Lenke', key: 'lenke', width: 18 },
  ];
  for (const o of okter) {
    const lenke = `${base}/okter/${o.innlegg}/`;
    ark.addRow({
      dato: excelDato(o.dato),
      tittel: o.tittel,
      type: TYPE_NAVN[o.type as keyof typeof TYPE_NAVN],
      kategori: o.kategori ? (KATEGORI_NAVN as Record<string, string>)[o.kategori] : o.aktivitet ? stor(o.aktivitet) : '',
      km: o.km ?? null,
      tid: o.sek != null ? o.sek / DAG : null,
      tempo: o.tempo != null ? Math.round(o.tempo) / DAG : null,
      opplevd: o.opplevd ? stor(o.opplevd) : '',
      planlagt: o.planlagt ?? '',
      uke: o.planUke ?? null,
      lenke: { text: 'Åpne innlegget', hyperlink: lenke },
    });
  }
  stilHode(ark);

  // ---- Styrke: én rad per sett ----
  const styrke = bok.addWorksheet('Styrke');
  styrke.columns = [
    { header: 'Dato', key: 'dato', width: 12, style: { numFmt: 'dd.mm.yyyy' } },
    { header: 'Innlegg', key: 'tittel', width: 34 },
    { header: 'Øvelse', key: 'ovelse', width: 18 },
    { header: 'Sett', key: 'sett', width: 7 },
    { header: 'Reps', key: 'reps', width: 7 },
    { header: 'Kg', key: 'kg', width: 8, style: { numFmt: '0.0' } },
    { header: 'Volum (kg × reps)', key: 'volum', width: 17, style: { numFmt: '0' } },
  ];
  for (const o of okter) {
    for (const ov of o.ovelser) {
      for (const s of ov.sett) {
        styrke.addRow({
          dato: excelDato(o.dato), tittel: o.tittel, ovelse: stor(ov.navn), sett: s.nr, reps: s.reps,
          kg: s.kg ?? null, volum: s.kg != null ? s.kg * s.reps : null,
        });
      }
    }
  }
  stilHode(styrke);

  // ---- Uker: sammendrag per uke ----
  const uker = bok.addWorksheet('Uker');
  uker.columns = [
    { header: 'År', key: 'ar', width: 7 },
    { header: 'Uke', key: 'uke', width: 6 },
    { header: 'Fra', key: 'fra', width: 12, style: { numFmt: 'dd.mm.yyyy' } },
    { header: 'Km løpt', key: 'km', width: 10, style: { numFmt: '0.0' } },
    { header: 'Økter', key: 'okter', width: 8 },
    { header: 'Løpeturer', key: 'lop', width: 10 },
    { header: 'Styrkeøkter', key: 'styrke', width: 12 },
    { header: 'Treningstid', key: 'tid', width: 12, style: { numFmt: '[h]:mm' } },
  ];
  const perUke = new Map<string, { km: number; okter: number; lop: number; styrke: number; sek: number }>();
  for (const o of okter) {
    const k = mandag(o.dato);
    const r = perUke.get(k) ?? { km: 0, okter: 0, lop: 0, styrke: 0, sek: 0 };
    r.okter += 1;
    r.sek += o.sek ?? 0;
    if (o.type === 'lop') { r.lop += 1; r.km += o.km ?? 0; }
    if (o.type === 'styrke') r.styrke += 1;
    perUke.set(k, r);
  }
  for (const [fra, r] of [...perUke].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const { ar, uke } = isoUke(fra);
    uker.addRow({ ar, uke, fra: excelDato(fra), km: r.km, okter: r.okter, lop: r.lop, styrke: r.styrke, tid: r.sek / DAG });
  }
  stilHode(uker);

  // ---- Om dataene ----
  const om = bok.addWorksheet('Om dataene');
  om.columns = [{ width: 18 }, { width: 70 }];
  om.addRows([
    [profil.bloggnavn],
    [],
    ['Generert', new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'],
    ['Kilde', { text: base || 'nettsiden', hyperlink: base || undefined }],
    ['Økter', okter.length],
    [],
    ['Arkene', 'Økter: én rad per økt. Styrke: én rad per sett. Uker: sammendrag per uke (mandag–søndag).'],
    ['Tider', 'Tid og tempo er ekte Excel-tider, så du kan summere og regne snitt direkte.'],
  ]);
  om.getRow(1).font = { bold: true, size: 14 };
  om.getColumn(1).font = { bold: true };

  const buffer = await bok.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
};
