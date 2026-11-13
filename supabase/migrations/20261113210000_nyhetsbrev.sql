-- Hvilke innlegg som er sendt som nyhetsbrev via Buttondown, så ingen sendes to ganger.
create table public.nyhetsbrev_sendt (
  slug           text primary key,
  sendt          timestamptz not null default now(),
  buttondown_id  text,
  status         text not null default 'sendt' check (status in ('sendt', 'hoppet_over'))
);
alter table public.nyhetsbrev_sendt enable row level security;
-- Ingen policyer: tabellen er bare for Edge-funksjonene (databasebrukeren).

-- Innlegg som fantes før nyhetsbrevet ble satt opp, skal ikke sendes.
insert into public.nyhetsbrev_sendt (slug, status)
select slug, 'hoppet_over' from public.innlegg
on conflict (slug) do nothing;
