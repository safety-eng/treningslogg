-- Treningslogg: speiling av markdown-filene i src/content/okter/.
-- GitHub-repoet er fasiten. scripts/sync-supabase.mjs skriver alt på nytt ved hver push,
-- så nøklene er naturlige tekstnøkler fra filnavnet (stabile på tvers av synker).

create table public.innlegg (
  slug        text primary key,                -- filnavn uten .md, f.eks. 2026-11-11-11-km-rolig
  dato        date not null,
  tittel      text not null,
  klokkeslett time,
  plan_navn   text,
  plan_uke    smallint check (plan_uke > 0),
  tekst       text not null default '',
  synket      timestamptz not null default now()
);
create index innlegg_dato_idx on public.innlegg (dato);

create table public.okter (
  id               text primary key,          -- <slug>-<nr>
  innlegg_slug     text not null references public.innlegg (slug) on delete cascade,
  nr               smallint not null check (nr > 0),
  dato             date not null,
  type             text not null check (type in ('lop', 'styrke', 'annet')),
  kategori         text check (kategori in ('rolig', 'langtur', 'terskel', 'intervall', 'tempo', 'konkurranse', 'restitusjon', 'annet')),
  aktivitet        text,
  distanse_km      numeric(6, 2) check (distanse_km > 0),
  varighet_sek     integer check (varighet_sek >= 0),
  tempo_sek_per_km numeric(6, 1) generated always as (
    case when type = 'lop' and distanse_km > 0 and varighet_sek is not null
      then round(varighet_sek / distanse_km, 1) end
  ) stored,
  opplevd          text check (opplevd in ('lett', 'moderat', 'hardt', 'maks')),
  planlagt         text,
  kilde            text,
  unique (innlegg_slug, nr)
);
create index okter_dato_idx on public.okter (dato);
create index okter_type_dato_idx on public.okter (type, dato);

create table public.ovelser (
  id     text primary key,                    -- <okt_id>-<nr>
  okt_id text not null references public.okter (id) on delete cascade,
  nr     smallint not null check (nr > 0),
  navn   text not null,                       -- normalisert, f.eks. "knebøy"
  unique (okt_id, nr)
);
create index ovelser_navn_idx on public.ovelser (navn);

create table public.sett (
  id        text primary key,                 -- <ovelse_id>-<nr>
  ovelse_id text not null references public.ovelser (id) on delete cascade,
  nr        smallint not null check (nr > 0),
  reps      smallint not null check (reps > 0),
  kg        numeric(6, 2) check (kg >= 0),
  unique (ovelse_id, nr)
);

-- Unike begrensninger over (fk, nr) dekker også indeks på fremmednøklene.

-- Åpen blogg: alle kan lese via API-et, ingen kan skrive (synken bruker databasebrukeren direkte).
alter table public.innlegg enable row level security;
alter table public.okter   enable row level security;
alter table public.ovelser enable row level security;
alter table public.sett    enable row level security;

create policy "Alle kan lese innlegg" on public.innlegg for select to anon, authenticated using (true);
create policy "Alle kan lese økter"   on public.okter   for select to anon, authenticated using (true);
create policy "Alle kan lese øvelser" on public.ovelser for select to anon, authenticated using (true);
create policy "Alle kan lese sett"    on public.sett    for select to anon, authenticated using (true);

-- Ukesoversikt (mandag som ukestart).
create view public.ukesoversikt
with (security_invoker = true) as
select
  date_trunc('week', dato)::date                                   as uke_start,
  extract(isoyear from dato)::int                                  as ar,
  extract(week from dato)::int                                     as uke,
  count(*)                                                         as okter,
  count(*) filter (where type = 'lop')                             as lopeturer,
  count(*) filter (where type = 'styrke')                          as styrkeokter,
  coalesce(sum(distanse_km) filter (where type = 'lop'), 0)        as km_lopt,
  round(coalesce(sum(varighet_sek), 0) / 3600.0, 2)                as timer
from public.okter
group by 1, 2, 3;

-- Beste sett per øvelse (tyngste kg, deretter flest reps).
create view public.tyngste_sett
with (security_invoker = true) as
select distinct on (o.navn)
  o.navn, s.kg, s.reps, k.dato, k.innlegg_slug
from public.sett s
join public.ovelser o on o.id = s.ovelse_id
join public.okter k on k.id = o.okt_id
order by o.navn, s.kg desc nulls last, s.reps desc, k.dato;
