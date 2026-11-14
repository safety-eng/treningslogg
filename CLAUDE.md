# Instruksjoner for Claude: Fredriks treningslogg

Åpen treningsblogg. Fredrik sender et bilde av en økt (skjermbilde fra klokke/app eller håndskrevet logg) og en kommentar. Du lager et innlegg, sjekker tallene med ham og pusher til `main`. Vercel bygger siden (https://treningslogg-plum.vercel.app). GitHub Action `synk-supabase.yml` venter på publiseringen og kaller Supabase-funksjonen `synk-treningslogg`, som henter `/data/synk.json` og skriver til databasen. Ingen hemmeligheter i GitHub.

## Arbeidsflyt for en ny økt

1. Les bildet. Hent ut dato, klokkeslett, type, distanse, tid, planlagt økt, kilde og eventuelle øvelser/sett.
2. Vis Fredrik et kort sammendrag av tallene før du pusher. Spør bare om det du er usikker på (håndskrift, uleselige tall). Er alt tydelig, holder én linje: «11,03 km på 58:55 (5:20/km), lett. Pusher nå.»
3. Lag filen `src/content/okter/ÅÅÅÅ-MM-DD-kort-beskrivelse.md`. Bruk kun a–z, 0–9 og bindestrek i filnavnet (ikke æøå).
   To økter samme dag, for eksempel løp og styrke, legges i samme fil som to elementer i `okter`.
4. Kjør `npm run build`. Bygget validerer skjemaet og stopper ved feil.
5. Commit med meldingen `Økt ÅÅÅÅ-MM-DD: <kort beskrivelse>` og push til `main`.

## Format

```yaml
---
tittel: "Kort, beskrivende tittel"
dato: "2026-11-11"          # ÅÅÅÅ-MM-DD, i anførselstegn
klokkeslett: "10:02"        # valgfri
plan:                       # valgfri, når økta er del av treningsplanen
  navn: "10 km under 40"    # må være lik mal.planNavn i src/data/profil.mjs
  uke: 1
okter:
  - type: lop
    kategori: rolig         # rolig | langtur | terskel | intervall | tempo | konkurranse | restitusjon | annet
    distanse_km: 11.03
    varighet: "58:55"       # mm:ss eller t:mm:ss
    opplevd: lett           # lett | moderat | hardt | maks (valgfri)
    planlagt: "Hva planen sa"
    kilde: "Garmin fenix 6 Pro"
  - type: styrke
    varighet: "45:00"       # valgfri
    ovelser:
      - navn: knebøy        # bruk navnene i ALIASER i src/lib/okt-core.mjs
        sett:
          - { reps: 5, kg: 80 }
  - type: annet
    aktivitet: sykkel
    distanse_km: 25         # valgfri
    varighet: "1:00:00"     # valgfri
bilder:                     # valgfri
  - src: "./bilder/2026-11-14-granasen.jpg"
    alt: "Beskrivelse av bildet for skjermlesere"
    tekst: "Bildetekst under bildet"   # valgfri
---
Selve innlegget.
```

## Innlegget

- Skriv på norsk bokmål, i førsteperson som Fredrik, kort og saklig (2–4 avsnitt).
- Bygg på kommentaren hans. Ikke legg til opplevelser eller detaljer han ikke har nevnt.
- Det er greit å sette økta i sammenheng med målet (10 km under 40:00, måltempo 4:00/km) og tidligere økter.

## Personvern (åpen blogg)

- Ikke publiser skjermbildene av treningsloggen. Bare tallene går inn i filen.
- Bilder Fredrik ber om å få med (natur, steder) legges i `src/content/okter/bilder/ÅÅÅÅ-MM-DD-sted.jpg` og i `bilder` i frontmatter.
  Lagre dem alltid på nytt uten metadata først (EXIF/GPS), f.eks. med PIL: `Image.open(fil).convert('RGB').save(ny, 'JPEG', quality=88)`.
- Ikke ta med kart, ruter, startsted, adresser eller GPS-data, selv om de står på skjermbildet.
- Nye innlegg sendes automatisk som e-post til abonnentene etter publisering. Rett feil før push, ikke etter.

## Prosjektet

- Astro 7, statisk side. Data: `src/content/okter/*.md`, skjema i `src/content.config.ts`.
- Felles beregninger (tempo, varighet, øvelsesnavn): `src/lib/okt-core.mjs`, som brukes av både siden og synken.
- Forsiden: `Hero.astro` (bilde i `src/assets/`, tekst i `hero` i `src/data/profil.mjs`, parallax med CSS scroll-animasjoner), så `MalSeksjon.astro` (nåværende mål og tempolinjal).
  Skriv animasjoner med langformer (`animation-name`, `animation-timeline` …), ellers lager minifiseringen en ugyldig shorthand.
- Rekkefølge på forsiden: Hero, NyhetsbrevSeksjon, MalSeksjon, Dashboard (statistikk), «Siste innlegg» (3 kort).
- Nyhetsbrev (Buttondown): skjema i `NyhetsbrevSkjema.astro` (seksjon under hero + popup i `Base.astro`, logikk i `src/scripts/nyhetsbrev.ts`).
  Påmelding går via Supabase-funksjonen `meld-pa` (dobbel bekreftelse hos Buttondown, ingenting lagres hos oss).
  `synk-treningslogg` sender nye innlegg (siste 7 dager) som e-post og sporer dem i `nyhetsbrev_sendt`.
  Begge krever secret `BUTTONDOWN_API_KEY` i Supabase. Personvernsiden: `src/pages/personvern.astro`.
- Delingsbilder: `/og/<id>.jpg` per innlegg og `/og/forside.jpg`, laget ved bygg med satori + sharp i `src/lib/delingsbilde.ts`
  (fonter i `src/assets/fonts/`). Open Graph-taggene settes i `Base.astro` via `bilde`-prop.
- Nedlastinger: `/data/okter.xlsx` (exceljs, ark: Økter, Styrke, Uker, Om dataene), `/data/okter.csv` og `/data/okter.json`, laget ved bygg i `src/pages/data/`.
  Kolonnene for CSV ligger i `EKSPORT_KOLONNER` i `okt-core.mjs` og brukes også av «Bare valgt periode»-knappen i dashbordet.
- Dashbordet: `src/components/Dashboard.astro` + `src/scripts/dashboard.ts`. Filtrene lagres i URL-en.
- Supabase-prosjekt: `treningslogg` (ref `mtjwkcunpjgvagptuiet`, eu-north-1). Skjema: `supabase/migrations/`.
  Tabeller: `innlegg`, `okter`, `ovelser`, `sett`, `synk_status`, og visningene `ukesoversikt` og `tyngste_sett`.
  Etter en push kan du sjekke synken med `select * from synk_status` (commit skal være den nye).
- Barlow Condensed ligger selv-hostet i `public/fonts/` med rettet Ø/ø (se `scripts/fiks-barlow-condensed.py`).
- Uten Astro-kompilatorens feil: ikke skriv `x! / y` i frontmatter i .astro-filer (tolkes som regex). Bruk `(x ?? 0) / y`.
