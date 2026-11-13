-- Husker sist synkede bygg, så gjentatte kall ikke skriver alt på nytt.
create table public.synk_status (
  id        smallint primary key default 1 check (id = 1),
  generert  text not null,
  commit    text,
  synket    timestamptz not null default now()
);
alter table public.synk_status enable row level security;
create policy "Alle kan lese synkstatus" on public.synk_status for select to anon, authenticated using (true);

create or replace function public.synk_treningslogg(data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(data -> 'innlegg') <> 'array' or data ->> 'generert' is null then
    raise exception 'Ugyldig data: mangler innlegg eller generert';
  end if;

  if exists (select 1 from public.synk_status where generert = data ->> 'generert') then
    return jsonb_build_object('uendret', true, 'generert', data ->> 'generert');
  end if;

  delete from public.innlegg;

  insert into public.innlegg (slug, dato, tittel, klokkeslett, plan_navn, plan_uke, tekst)
  select slug, dato, tittel, klokkeslett, plan_navn, plan_uke, coalesce(tekst, '')
  from jsonb_populate_recordset(null::public.innlegg, data -> 'innlegg');

  insert into public.okter (id, innlegg_slug, nr, dato, type, kategori, aktivitet, distanse_km, varighet_sek, opplevd, planlagt, kilde)
  select id, innlegg_slug, nr, dato, type, kategori, aktivitet, distanse_km, varighet_sek, opplevd, planlagt, kilde
  from jsonb_populate_recordset(null::public.okter, coalesce(data -> 'okter', '[]'));

  insert into public.ovelser (id, okt_id, nr, navn)
  select id, okt_id, nr, navn
  from jsonb_populate_recordset(null::public.ovelser, coalesce(data -> 'ovelser', '[]'));

  insert into public.sett (id, ovelse_id, nr, reps, kg)
  select id, ovelse_id, nr, reps, kg
  from jsonb_populate_recordset(null::public.sett, coalesce(data -> 'sett', '[]'));

  insert into public.synk_status (id, generert, commit, synket)
  values (1, data ->> 'generert', data ->> 'commit', now())
  on conflict (id) do update set generert = excluded.generert, commit = excluded.commit, synket = excluded.synket;

  return jsonb_build_object(
    'uendret', false,
    'innlegg', (select count(*) from public.innlegg),
    'okter',   (select count(*) from public.okter),
    'ovelser', (select count(*) from public.ovelser),
    'sett',    (select count(*) from public.sett)
  );
end;
$$;

revoke execute on function public.synk_treningslogg(jsonb) from public, anon, authenticated;
