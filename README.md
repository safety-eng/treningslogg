# Fredriks treningslogg

Åpen treningsblogg med statistikk. Hver økt er en markdown-fil i `src/content/okter/`. Forsiden viser målet (10 km under 40:00) og et filtrerbart dashbord.

## Slik henger det sammen

```
Bilde + kommentar → Claude → GitHub (main)
                               ├─ Vercel bygger og publiserer siden (treningslogg-plum.vercel.app)
                               └─ GitHub Action venter på publiseringen og kaller Supabase-funksjonen
                                    synk-treningslogg, som henter /data/synk.json og skriver til databasen
```

Repoet er fasiten. Databasen er en kopi som bygges opp på nytt fra nettsiden. Ingen passord eller nøkler ligger i GitHub. Supabase-funksjonen bruker sin innebygde databasetilgang, og pg_cron kjører den også hver time som sikkerhetsnett.

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Lokal utviklingsserver |
| `npm run build` | Bygger siden og validerer alle økt-filene |
| `npm run synk` | Manuell synk direkte til databasen (krever `DATABASE_URL`, trengs vanligvis ikke) |
| `node scripts/sync-supabase.mjs --sql` | Skriver synken som SQL i stedet for å kjøre den |

## Supabase

- Prosjekt: `treningslogg` (ref `mtjwkcunpjgvagptuiet`, Stockholm)
- Funksjon: `supabase/functions/synk-treningslogg/` (synker bare hvis bygget er nytt, se tabellen `synk_status`)
- Kjør synken manuelt: GitHub → Actions → **Synk til Supabase** → Run workflow

## Åpne data

- `/data/okter.json`: alle økter som JSON
- `/data/synk.json`: alle tabellradene, slik Supabase lagrer dem
- Supabase-tabellene kan leses av alle via API-et (kun lesing)

## Nyttige SQL-spørringer

```sql
select * from ukesoversikt order by uke_start desc;
select * from tyngste_sett;
select dato, distanse_km, tempo_sek_per_km from okter where type = 'lop' order by dato;
```
