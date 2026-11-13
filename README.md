# Fredriks treningslogg

Åpen treningsblogg med statistikk. Hver økt er en markdown-fil i `src/content/okter/`. Forsiden viser målet (10 km under 40:00) og et filtrerbart dashbord.

## Slik henger det sammen

```
Bilde + kommentar → Claude → GitHub (main)
                               ├─ Vercel bygger og publiserer siden
                               └─ GitHub Action speiler dataene til Supabase
```

Repoet er fasiten. Databasen er en kopi som kan bygges opp på nytt når som helst (`npm run synk`).

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `npm run dev` | Lokal utviklingsserver |
| `npm run build` | Bygger siden og validerer alle økt-filene |
| `npm run synk` | Speiler økter til Supabase (krever `DATABASE_URL`) |
| `node scripts/sync-supabase.mjs --sql` | Skriver synken som SQL i stedet for å kjøre den |

## Oppsett av Supabase-synken

1. Supabase → prosjektet `treningslogg` → **Connect** → kopier **Session pooler**-adressen (IPv4). Bytt `[YOUR-PASSWORD]` med databasepassordet. Er det glemt, kan det nullstilles under Database settings.
2. GitHub → repoet → Settings → Secrets and variables → Actions → **New repository secret**. Navn: `DATABASE_URL`, verdi: adressen fra steg 1.
3. Kjør workflowen **Synk til Supabase** én gang manuelt for å teste.

Uten secret hopper workflowen over synken uten å feile.

## Åpne data

- `/data/okter.json`: alle økter som JSON
- Supabase-tabellene kan leses av alle via API-et (kun lesing)

## Nyttige SQL-spørringer

```sql
select * from ukesoversikt order by uke_start desc;
select * from tyngste_sett;
select dato, distanse_km, tempo_sek_per_km from okter where type = 'lop' order by dato;
```
