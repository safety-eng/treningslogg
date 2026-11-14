import { formatKlokke, formatTimer, formatTempo, somCsv, TYPE_NAVN, KATEGORI_NAVN } from '../lib/okt-core.mjs';

type Type = 'lop' | 'styrke' | 'annet';
interface Sett { nr: number; reps: number; kg: number | null }
interface Okt {
  id: string; innlegg: string; tittel: string; dato: string; nr: number; type: Type;
  kategori: string | null; aktivitet: string | null; km: number | null; sek: number | null;
  tempo: number | null; opplevd: string | null;
  ovelser: { navn: string; nr: number; sett: Sett[] }[];
}
type Periode = 'alle' | '7d' | '30d' | 'ar' | 'maned' | 'egen';
interface Tilstand { periode: Periode; maned: string; fra: string; til: string; type: 'alle' | Type }

const NS = 'http://www.w3.org/2000/svg';
const tall1 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 1 });
const tall2 = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 });
const heltall = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });
const fmtManed = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtManedKort = new Intl.DateTimeFormat('nb-NO', { month: 'short', timeZone: 'UTC' });
const fmtKort = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtLang = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtDag = new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

// ---------- datoer (alltid "ÅÅÅÅ-MM-DD", regnet i UTC) ----------
const pad = (n: number) => String(n).padStart(2, '0');
const tilDato = (iso: string) => new Date(`${iso}T00:00:00Z`);
const tilIso = (d: Date) => d.toISOString().slice(0, 10);
const leggTil = (iso: string, dager: number) => { const d = tilDato(iso); d.setUTCDate(d.getUTCDate() + dager); return tilIso(d); };
const idag = () => { const n = new Date(); return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`; };
const ukedagIndeks = (iso: string) => (tilDato(iso).getUTCDay() + 6) % 7; // man = 0
const mandag = (iso: string) => leggTil(iso, -ukedagIndeks(iso));
function isoUke(iso: string) {
  const d = tilDato(iso);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
}
const kortDato = (iso: string) => fmtKort.format(tilDato(iso));

// ---------- hjelpere ----------
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, stil: Partial<CSSStyleDeclaration> = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  Object.assign(el.style, stil);
  return el;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, tekst?: string, klasse?: string) {
  const e = document.createElement(tag);
  if (tekst != null) e.textContent = tekst;
  if (klasse) e.className = klasse;
  return e;
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const stor = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ryddig toppverdi og steg for y-aksen. */
function rundAkse(maks: number) {
  if (maks <= 0) return { topp: 10, steg: 5 };
  const kandidater = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  const steg = kandidater.find((s) => maks / s <= 4) ?? 1000;
  return { topp: Math.ceil(maks / steg) * steg, steg };
}

/** Søyle med 4px avrundet topp og rett bunn mot grunnlinjen. */
function soylebane(x: number, y: number, b: number, h: number) {
  const r = Math.min(4, b / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + b - r}Q${x + b},${y} ${x + b},${y + r}V${y + h}Z`;
}

export function startDashboard() {
  const dataEl = document.getElementById('okter-data');
  if (!dataEl) return;
  const alle: Okt[] = JSON.parse(dataEl.textContent || '[]');
  const skjema = document.getElementById('filtre') as HTMLFormElement;
  const tooltip = document.getElementById('tooltip') as HTMLDivElement;
  const manedVelger = document.getElementById('maned') as HTMLSelectElement;
  const fraInput = document.getElementById('fra') as HTMLInputElement;
  const tilInput = document.getElementById('til') as HTMLInputElement;

  // Måneder fra første økt til i dag, nyeste først.
  const iDag = idag();
  const forsteManed = (alle[0]?.dato ?? iDag).slice(0, 7);
  const maneder: string[] = [];
  for (let m = iDag.slice(0, 7); m >= forsteManed; ) {
    maneder.push(m);
    const [y, mm] = m.split('-').map(Number);
    m = mm === 1 ? `${y - 1}-12` : `${y}-${pad(mm - 1)}`;
  }
  for (const m of maneder) {
    const o = el('option', stor(fmtManed.format(tilDato(`${m}-01`))));
    o.value = m;
    manedVelger.append(o);
  }

  // ---------- tilstand <-> URL ----------
  function lesUrl(): Tilstand {
    const q = new URLSearchParams(location.search);
    const periode = (['alle', '7d', '30d', 'ar', 'maned', 'egen'].includes(q.get('periode') ?? '') ? q.get('periode') : 'alle') as Periode;
    const type = (['alle', 'lop', 'styrke', 'annet'].includes(q.get('type') ?? '') ? q.get('type') : 'alle') as Tilstand['type'];
    const maned = maneder.includes(q.get('maned') ?? '') ? q.get('maned')! : maneder[0];
    const gyldig = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '');
    return { periode, type, maned, fra: gyldig(q.get('fra')), til: gyldig(q.get('til')) };
  }
  function skrivSkjema(t: Tilstand) {
    (skjema.querySelector(`input[name=periode][value="${t.periode}"]`) as HTMLInputElement).checked = true;
    (skjema.querySelector(`input[name=type][value="${t.type}"]`) as HTMLInputElement).checked = true;
    manedVelger.value = t.maned;
    fraInput.value = t.fra || (alle[0]?.dato ?? iDag);
    tilInput.value = t.til || iDag;
  }
  function lesSkjema(): Tilstand {
    const f = new FormData(skjema);
    return {
      periode: f.get('periode') as Periode,
      type: f.get('type') as Tilstand['type'],
      maned: manedVelger.value,
      fra: fraInput.value,
      til: tilInput.value,
    };
  }
  function skrivUrl(t: Tilstand) {
    const q = new URLSearchParams();
    if (t.periode !== 'alle') q.set('periode', t.periode);
    if (t.periode === 'maned') q.set('maned', t.maned);
    if (t.periode === 'egen') { if (t.fra) q.set('fra', t.fra); if (t.til) q.set('til', t.til); }
    if (t.type !== 'alle') q.set('type', t.type);
    const s = q.toString();
    // Behold #anker (f.eks. /#statistikk), så nettleseren fortsatt ruller dit.
    history.replaceState(null, '', (s ? `?${s}` : location.pathname) + location.hash);
  }

  function intervall(t: Tilstand): [string, string] {
    const forste = alle[0]?.dato ?? iDag;
    switch (t.periode) {
      case '7d': return [leggTil(iDag, -6), iDag];
      case '30d': return [leggTil(iDag, -29), iDag];
      case 'ar': return [`${iDag.slice(0, 4)}-01-01`, iDag];
      case 'maned': {
        const [y, m] = t.maned.split('-').map(Number);
        return [`${t.maned}-01`, tilIso(new Date(Date.UTC(y, m, 0)))];
      }
      case 'egen': {
        let fra = t.fra || forste, til = t.til || iDag;
        if (fra > til) [fra, til] = [til, fra];
        return [fra, til];
      }
      default: {
        const sist = alle.at(-1)?.dato ?? iDag;
        return [forste < iDag ? forste : iDag, sist > iDag ? sist : iDag];
      }
    }
  }

  // ---------- tooltip ----------
  function visTips(linjer: [string, string?][], x: number, y: number) {
    tooltip.replaceChildren();
    linjer.forEach(([sterk, svak], i) => {
      const rad = el('div');
      const s = el(i === 0 ? 'strong' : 'span', sterk);
      rad.append(s);
      if (svak) rad.append(el('span', ` ${svak}`));
      tooltip.append(rad);
    });
    tooltip.hidden = false;
    const r = tooltip.getBoundingClientRect();
    const vx = Math.min(x + 14, window.innerWidth - r.width - 8);
    const vy = y + 14 + r.height > window.innerHeight ? y - r.height - 10 : y + 14;
    tooltip.style.left = `${Math.max(8, vx)}px`;
    tooltip.style.top = `${vy}px`;
  }
  const skjulTips = () => { tooltip.hidden = true; };
  function koblTips(mal: Element, linjer: () => [string, string?][]) {
    mal.addEventListener('pointermove', (e) => { const p = e as PointerEvent; visTips(linjer(), p.clientX, p.clientY); });
    mal.addEventListener('pointerleave', skjulTips);
    mal.addEventListener('focus', () => { const r = mal.getBoundingClientRect(); visTips(linjer(), r.left + r.width / 2, r.top); });
    mal.addEventListener('blur', skjulTips);
  }

  // ---------- nøkkeltall ----------
  function settTall(felt: string, verdi: string, enhet?: string) {
    const dd = document.querySelector(`#tall [data-felt="${felt}"]`);
    if (!dd) return;
    dd.replaceChildren(document.createTextNode(verdi));
    if (enhet) {
      const s = el('span', ` ${enhet}`);
      s.style.fontSize = '0.55em';
      s.style.fontWeight = '500';
      s.style.color = 'var(--ink-2)';
      dd.append(s);
    }
  }

  // ---------- ukediagram ----------
  function tegnUker(utvalg: Okt[], fra: string, til: string, t: Tilstand) {
    const plott = document.getElementById('uker-plott')!;
    const tittel = document.getElementById('uker-tittel')!;
    const brukTid = t.type === 'styrke' || t.type === 'annet';
    const verdiAv = (o: Okt) => (brukTid ? (o.sek ?? 0) / 3600 : o.type === 'lop' ? o.km ?? 0 : 0);

    const forsteMandag = mandag(fra);
    const antallUker = Math.floor((tilDato(mandag(til)).getTime() - tilDato(forsteMandag).getTime()) / (7 * 86400000)) + 1;
    const perManed = antallUker > 60;

    type Botte = { nokkel: string; etikett: string; tips: string; verdi: number; okter: number };
    const bøtter: Botte[] = [];
    if (perManed) {
      for (let m = fra.slice(0, 7); m <= til.slice(0, 7); ) {
        const d = tilDato(`${m}-01`);
        bøtter.push({ nokkel: m, etikett: fmtManedKort.format(d), tips: stor(fmtManed.format(d)), verdi: 0, okter: 0 });
        const [y, mm] = m.split('-').map(Number);
        m = mm === 12 ? `${y + 1}-01` : `${y}-${pad(mm + 1)}`;
      }
    } else {
      for (let i = 0; i < antallUker; i++) {
        const man = leggTil(forsteMandag, i * 7);
        bøtter.push({ nokkel: man, etikett: `${isoUke(man)}`, tips: `Uke ${isoUke(man)}, ${kortDato(man)}–${kortDato(leggTil(man, 6))}`, verdi: 0, okter: 0 });
      }
    }
    const indeks = new Map(bøtter.map((b, i) => [b.nokkel, i]));
    for (const o of utvalg) {
      const i = indeks.get(perManed ? o.dato.slice(0, 7) : mandag(o.dato));
      if (i == null) continue;
      bøtter[i].verdi += verdiAv(o);
      bøtter[i].okter += 1;
    }

    tittel.textContent = `${brukTid ? 'Treningstimer' : 'Kilometer løpt'} per ${perManed ? 'måned' : 'uke'}`;
    const enhet = brukTid ? 't' : 'km';
    const fmtVerdi = (v: number) => (brukTid ? `${tall1.format(v)} t` : `${tall1.format(v)} km`);

    const B = Math.max(260, plott.clientWidth);
    const H = 230;
    const m = { v: 34, h: 6, o: 22, u: 26 };
    const iw = B - m.v - m.h;
    const ih = H - m.o - m.u;
    const maks = Math.max(0, ...bøtter.map((b) => b.verdi));
    const { topp, steg } = rundAkse(maks);
    const y = (v: number) => m.o + ih - (v / topp) * ih;
    const band = iw / bøtter.length;
    const bredde = Math.max(3, Math.min(24, band * 0.7));

    const root = svg('svg', { width: B, height: H, viewBox: `0 0 ${B} ${H}`, role: 'img', 'aria-label': `${tittel.textContent}. Verdiene står også i tabellen under.` }, { display: 'block', overflow: 'visible' });

    for (let v = 0; v <= topp + 1e-9; v += steg) {
      root.append(svg('line', { x1: m.v, x2: B - m.h, y1: y(v), y2: y(v) }, { stroke: v === 0 ? 'var(--axis)' : 'var(--rule)', strokeWidth: '1', shapeRendering: 'crispEdges' }));
      const t = svg('text', { x: m.v - 8, y: y(v) + 4, 'text-anchor': 'end' }, { fill: 'var(--muted)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' });
      t.textContent = tall1.format(v);
      root.append(t);
    }
    const enhetTekst = svg('text', { x: m.v - 8, y: m.o - 9, 'text-anchor': 'end' }, { fill: 'var(--muted)', fontSize: '12px' });
    enhetTekst.textContent = enhet;
    root.append(enhetTekst);

    const etikettHver = Math.max(1, Math.ceil((perManed ? 34 : 26) / band));
    let sisteMedVerdi = -1;
    bøtter.forEach((b, i) => { if (b.verdi > 0) sisteMedVerdi = i; });
    const maksIndeks = bøtter.findIndex((b) => b.verdi === maks && maks > 0);

    bøtter.forEach((b, i) => {
      const cx = m.v + band * i + band / 2;
      const g = svg('g', { tabindex: 0, role: 'img', 'aria-label': `${b.tips}: ${fmtVerdi(b.verdi)}, ${b.okter} økter` }, { outline: 'none' });
      g.append(svg('rect', { x: m.v + band * i, y: m.o, width: band, height: ih + m.u }, { fill: 'transparent' }));
      if (b.verdi > 0) {
        const h = Math.max(2, (b.verdi / topp) * ih);
        g.append(svg('path', { d: soylebane(cx - bredde / 2, m.o + ih - h, bredde, h), class: 'soyle' }, { fill: 'var(--run)' }));
        if (i === maksIndeks || i === sisteMedVerdi) {
          const t = svg('text', { x: cx, y: m.o + ih - h - 6, 'text-anchor': 'middle' }, { fill: 'var(--ink)', fontSize: '12px', fontWeight: '600' });
          t.textContent = tall1.format(b.verdi);
          g.append(t);
        }
      }
      if (i % etikettHver === 0 || bøtter.length === 1) {
        const t = svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, { fill: 'var(--muted)', fontSize: '12px' });
        t.textContent = perManed ? b.etikett : (i === 0 ? `uke ${b.etikett}` : b.etikett);
        g.append(t);
      }
      koblTips(g, () => [[fmtVerdi(b.verdi), ''], [b.tips], [`${b.okter} ${b.okter === 1 ? 'økt' : 'økter'}`]]);
      g.addEventListener('pointerenter', () => g.querySelector('.soyle')?.setAttribute('opacity', '0.8'));
      g.addEventListener('pointerleave', () => g.querySelector('.soyle')?.removeAttribute('opacity'));
      g.addEventListener('focus', () => g.querySelector('.soyle')?.setAttribute('opacity', '0.8'));
      g.addEventListener('blur', () => g.querySelector('.soyle')?.removeAttribute('opacity'));
      root.append(g);
    });
    plott.replaceChildren(root);
  }

  // ---------- treningskalender ----------
  function tegnKalender(utvalg: Okt[], fra: string, til: string) {
    const plott = document.getElementById('kalender-plott')!;
    const minutter = new Map<string, number>();
    const perDag = new Map<string, Okt[]>();
    for (const o of utvalg) {
      minutter.set(o.dato, (minutter.get(o.dato) ?? 0) + (o.sek ? o.sek / 60 : 1));
      perDag.set(o.dato, [...(perDag.get(o.dato) ?? []), o]);
    }
    const sluttMandag = mandag(til);
    let startMandag = mandag(fra);
    const tidligst = leggTil(sluttMandag, -52 * 7);
    if (startMandag < tidligst) startMandag = tidligst;
    const kolonner = Math.round((tilDato(sluttMandag).getTime() - tilDato(startMandag).getTime()) / (7 * 86400000)) + 1;

    const venstre = 30, topp = 20;
    const B = Math.max(200, plott.clientWidth);
    const celle = Math.max(8, Math.min(18, Math.floor((B - venstre) / kolonner) - 2));
    const steg = celle + 2;
    const H = topp + 7 * steg;
    const W = Math.min(B, venstre + kolonner * steg);
    const farge = (min: number) => (min <= 0 ? 'var(--cell-empty)' : min <= 30 ? 'var(--seq-1)' : min <= 60 ? 'var(--seq-2)' : min <= 90 ? 'var(--seq-3)' : 'var(--seq-4)');

    const root = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Treningskalender: minutter trening per dag. Øktene står i tabellen under.' }, { display: 'block' });
    ['man', 'ons', 'fre'].forEach((d, i) => {
      const t = svg('text', { x: 0, y: topp + (i * 2) * steg + celle - 2 }, { fill: 'var(--muted)', fontSize: '11px' });
      t.textContent = d;
      root.append(t);
    });
    let sisteEtikett = -99;
    for (let k = 0; k < kolonner; k++) {
      const man = leggTil(startMandag, k * 7);
      // Månedsnavn over kolonnen der den 1. i måneden ligger (og over første kolonne).
      const forsteDag = [0, 1, 2, 3, 4, 5, 6].map((r) => leggTil(man, r)).find((d) => d.slice(8) === '01');
      const etikettDag = forsteDag ?? (k === 0 ? man : null);
      if (etikettDag && k - sisteEtikett >= 3) {
        const t = svg('text', { x: venstre + k * steg, y: 12 }, { fill: 'var(--muted)', fontSize: '11px' });
        t.textContent = fmtManedKort.format(tilDato(etikettDag));
        root.append(t);
        sisteEtikett = k;
      }
      for (let r = 0; r < 7; r++) {
        const dag = leggTil(man, r);
        if (dag < fra || dag > til || dag > iDag) continue;
        const min = minutter.get(dag) ?? 0;
        const rect = svg('rect', { x: venstre + k * steg, y: topp + r * steg, width: celle, height: celle, rx: 2 }, { fill: farge(min) });
        const okterDag = perDag.get(dag) ?? [];
        koblTips(rect, () => [
          [okterDag.length ? (minutter.get(dag)! >= 1 ? formatTimer((minutter.get(dag) ?? 0) * 60) : 'Trent') : 'Hviledag'],
          [stor(fmtDag.format(tilDato(dag)))],
          ...okterDag.map((o) => [beskrivType(o)] as [string]),
        ]);
        root.append(rect);
      }
    }
    plott.replaceChildren(root);
  }

  function beskrivType(o: Okt) {
    if (o.type === 'lop') return `Løp${o.kategori ? `, ${(KATEGORI_NAVN as Record<string, string>)[o.kategori]?.toLowerCase() ?? o.kategori}` : ''}${o.km ? `, ${tall2.format(o.km)} km` : ''}`;
    if (o.type === 'annet') return stor(o.aktivitet ?? 'Annet');
    return TYPE_NAVN[o.type];
  }

  // ---------- tabeller ----------
  function fyllTabell(utvalg: Okt[]) {
    const tbody = document.querySelector('#tabell tbody')!;
    const tom = document.getElementById('tom')!;
    tbody.replaceChildren();
    const rader = [...utvalg].sort((a, b) => (a.dato === b.dato ? b.nr - a.nr : a.dato < b.dato ? 1 : -1));
    for (const o of rader) {
      const tr = el('tr');
      tr.append(el('td', kortDato(o.dato) + ' ' + o.dato.slice(0, 4), 'dato'));
      const tdTittel = el('td', undefined, 'okt');
      const a = el('a', o.tittel);
      a.href = `/okter/${o.innlegg}/`;
      tdTittel.append(a);
      tr.append(tdTittel);
      const tdType = el('td', undefined, 'type');
      const prikk = el('i', undefined, `nokkel ${o.type}`);
      prikk.style.marginRight = '0.45rem';
      tdType.append(prikk, document.createTextNode(beskrivType(o).replace(/, [\d,]+ km$/, '')));
      tr.append(tdType);
      tr.append(el('td', o.km ? `${tall2.format(o.km)} km` : '–', `h km${o.km ? '' : ' tom'}`));
      tr.append(el('td', o.sek ? formatKlokke(o.sek) : '–', `h tid${o.sek ? '' : ' tom'}`));
      tr.append(el('td', o.tempo ? `${formatTempo(o.tempo)} /km` : '–', `h tempo${o.tempo ? '' : ' tom'}`));
      tr.append(el('td', o.opplevd ? stor(o.opplevd) : '–', `opplevd${o.opplevd ? '' : ' tom'}`));
      tbody.append(tr);
    }
    tom.hidden = rader.length > 0;
    (document.getElementById('tabell') as HTMLTableElement).hidden = rader.length === 0;
  }

  function fyllStyrke(utvalg: Okt[]) {
    const seksjon = document.getElementById('styrke-seksjon')!;
    const tbody = document.querySelector('#styrke-tabell tbody')!;
    const per = new Map<string, { sett: number; tyngst: Sett | null; volum: number }>();
    for (const o of utvalg) {
      for (const ov of o.ovelser) {
        const r = per.get(ov.navn) ?? { sett: 0, tyngst: null, volum: 0 };
        for (const s of ov.sett) {
          r.sett += 1;
          r.volum += s.reps * (s.kg ?? 0);
          if (!r.tyngst || (s.kg ?? 0) > (r.tyngst.kg ?? 0) || ((s.kg ?? 0) === (r.tyngst.kg ?? 0) && s.reps > r.tyngst.reps)) r.tyngst = s;
        }
        per.set(ov.navn, r);
      }
    }
    seksjon.hidden = per.size === 0;
    tbody.replaceChildren();
    for (const [navn, r] of [...per].sort((a, b) => b[1].volum - a[1].volum)) {
      const tr = el('tr');
      tr.append(el('td', stor(navn)));
      tr.append(el('td', String(r.sett), 'h'));
      tr.append(el('td', r.tyngst ? (r.tyngst.kg ? `${tall1.format(r.tyngst.kg)} kg × ${r.tyngst.reps}` : `${r.tyngst.reps} reps`) : '–', 'h'));
      tr.append(el('td', r.volum ? `${heltall.format(r.volum)} kg` : '–', 'h'));
      tbody.append(tr);
    }
  }

  // ---------- tegn alt ----------
  let sist: { utvalg: Okt[]; fra: string; til: string; t: Tilstand } | null = null;
  function oppdater() {
    const t = lesSkjema();
    (document.getElementById('velg-maned') as HTMLElement).hidden = t.periode !== 'maned';
    (document.getElementById('velg-egen') as HTMLElement).hidden = t.periode !== 'egen';
    skrivUrl(t);
    const [fra, til] = intervall(t);
    const utvalg = alle.filter((o) => o.dato >= fra && o.dato <= til && (t.type === 'alle' || o.type === t.type));
    const lop = utvalg.filter((o) => o.type === 'lop');
    const lopMedTid = lop.filter((o) => o.km && o.sek);
    const kmLop = sum(lop.map((o) => o.km ?? 0));
    const tempoSnitt = lopMedTid.length ? sum(lopMedTid.map((o) => o.sek!)) / sum(lopMedTid.map((o) => o.km!)) : null;
    const visLop = t.type === 'alle' || t.type === 'lop';

    settTall('km', visLop ? tall1.format(kmLop) : '–');
    settTall('okter', String(utvalg.length));
    settTall('lop', String(lop.length));
    settTall('styrke', String(utvalg.filter((o) => o.type === 'styrke').length));
    settTall('tid', formatTimer(sum(utvalg.map((o) => o.sek ?? 0))));
    settTall('tempo', tempoSnitt ? formatTempo(tempoSnitt) : '–', tempoSnitt ? '/km' : undefined);

    const periodeTekst = document.getElementById('periode-tekst')!;
    periodeTekst.textContent = `Viser ${fmtLang.format(tilDato(fra))} til ${fmtLang.format(tilDato(til))}: ${utvalg.length} ${utvalg.length === 1 ? 'økt' : 'økter'}.`;

    sist = { utvalg, fra, til, t };
    tegnUker(utvalg, fra, til, t);
    tegnKalender(utvalg, fra, til);
    fyllTabell(utvalg);
    fyllStyrke(utvalg);
  }

  // Last ned bare økter i valgt periode og type som CSV.
  document.getElementById('last-ned-periode')?.addEventListener('click', () => {
    if (!sist) return;
    const csv = somCsv(sist.utvalg, location.origin);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `treningslogg-${sist.fra}-til-${sist.til}${sist.t.type !== 'alle' ? `-${sist.t.type}` : ''}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  skrivSkjema(lesUrl());
  skjema.addEventListener('change', oppdater);
  skjema.addEventListener('submit', (e) => e.preventDefault());
  oppdater();

  let ventende = 0;
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(ventende);
    ventende = requestAnimationFrame(() => {
      if (!sist) return;
      tegnUker(sist.utvalg, sist.fra, sist.til, sist.t);
      tegnKalender(sist.utvalg, sist.fra, sist.til);
    });
  });
  ro.observe(document.getElementById('uker-plott')!);
}
