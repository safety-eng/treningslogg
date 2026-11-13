// Felles logikk for nettsiden (Astro) og Supabase-synken (Node).
// Ren JavaScript uten avhengigheter, slik at begge kan importere den.

/** "58:55" eller "1:02:30" -> sekunder. Tom/ugyldig verdi gir null. */
export function parseVarighet(tekst) {
  if (tekst == null || tekst === '') return null;
  const deler = String(tekst).trim().split(':').map(Number);
  if (deler.some((d) => !Number.isFinite(d) || d < 0)) return null;
  if (deler.length === 2) return deler[0] * 60 + deler[1];
  if (deler.length === 3) return deler[0] * 3600 + deler[1] * 60 + deler[2];
  return null;
}

/** sekunder -> "58:55" / "1:02:30" */
export function formatKlokke(sek) {
  if (sek == null) return '–';
  const s = Math.round(sek);
  const t = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = t > 0 ? String(m).padStart(2, '0') : String(m);
  return (t > 0 ? `${t}:` : '') + `${mm}:${String(r).padStart(2, '0')}`;
}

/** sekunder -> "12 t 5 min" / "59 min" */
export function formatTimer(sek) {
  if (!sek) return '0 min';
  const min = Math.round(sek / 60);
  const t = Math.floor(min / 60);
  const m = min % 60;
  if (t === 0) return `${m} min`;
  return m === 0 ? `${t} t` : `${t} t ${m} min`;
}

/** sekunder per km -> "5:20" */
export function formatTempo(sekPerKm) {
  if (sekPerKm == null || !Number.isFinite(sekPerKm)) return '–';
  let m = Math.floor(sekPerKm / 60);
  let s = Math.round(sekPerKm - m * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function tempo(km, sek) {
  return km && sek ? sek / km : null;
}

/** Riegels formel: forventet tid på ny distanse ut fra en kjent prestasjon. */
export function riegel(sekKjent, kmKjent, kmNy, eksponent = 1.06) {
  return sekKjent * Math.pow(kmNy / kmKjent, eksponent);
}

/** Øvelsesnavn til fast form, slik at statistikk per øvelse holder. */
const ALIASER = {
  'squat': 'knebøy', 'knebøy': 'knebøy', 'back squat': 'knebøy',
  'deadlift': 'markløft', 'markløft': 'markløft',
  'bench press': 'benkpress', 'benkpress': 'benkpress', 'benk': 'benkpress',
  'overhead press': 'skulderpress', 'militærpress': 'skulderpress', 'skulderpress': 'skulderpress',
  'pull-ups': 'pull-ups', 'pullups': 'pull-ups', 'chins': 'chins', 'chin-ups': 'chins',
  'roing': 'roing', 'row': 'roing', 'stangroing': 'roing',
  'utfall': 'utfall', 'lunges': 'utfall',
  'hip thrust': 'hip thrust', 'planke': 'planke', 'plank': 'planke',
  'tåhev': 'tåhev', 'calf raises': 'tåhev',
};
export function normaliserOvelse(navn) {
  const n = String(navn).trim().toLowerCase();
  return ALIASER[n] ?? n;
}

/**
 * Gjør innlegg (én fil per dag) om til en flat liste med økter.
 * innlegg: [{ id, data: { tittel, dato, okter: [...] , plan } }]
 */
export function flatUt(innlegg) {
  const ut = [];
  for (const inn of innlegg) {
    const d = inn.data;
    d.okter.forEach((o, i) => {
      const sek = parseVarighet(o.varighet);
      const km = o.distanse_km ?? null;
      ut.push({
        id: `${inn.id}-${i + 1}`,
        innlegg: inn.id,
        tittel: d.tittel,
        dato: d.dato,
        nr: i + 1,
        type: o.type,
        kategori: o.kategori ?? null,
        aktivitet: o.aktivitet ?? null,
        km,
        sek,
        tempo: o.type === 'lop' ? tempo(km, sek) : null,
        opplevd: o.opplevd ?? null,
        planlagt: o.planlagt ?? null,
        kilde: o.kilde ?? null,
        planUke: d.plan?.uke ?? null,
        ovelser: (o.ovelser ?? []).map((ov, j) => ({
          navn: normaliserOvelse(ov.navn),
          nr: j + 1,
          sett: ov.sett.map((s, k) => ({ nr: k + 1, reps: s.reps, kg: s.kg ?? null })),
        })),
      });
    });
  }
  return ut.sort((a, b) => (a.dato === b.dato ? a.nr - b.nr : a.dato < b.dato ? -1 : 1));
}

export const TYPE_NAVN = { lop: 'Løp', styrke: 'Styrke', annet: 'Annet' };
export const KATEGORI_NAVN = {
  rolig: 'Rolig', langtur: 'Langtur', terskel: 'Terskel', intervall: 'Intervall',
  tempo: 'Tempo', konkurranse: 'Konkurranse', restitusjon: 'Restitusjon', annet: 'Annet',
};
