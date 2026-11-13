-- Synk uten passord: Edge-funksjonen synk-treningslogg henter /data/synk.json fra nettsiden
-- og kaller denne funksjonen. Alt erstattes i én transaksjon, så databasen alltid speiler repoet.
create or replace function public.synk_treningslogg(data jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(data -> 'innlegg') <> 'array' then
    raise exception 'Ugyldig data: mangler innlegg';
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

  return jsonb_build_object(
    'innlegg', (select count(*) from public.innlegg),
    'okter',   (select count(*) from public.okter),
    'ovelser', (select count(*) from public.ovelser),
    'sett',    (select count(*) from public.sett)
  );
end;
$$;

-- Bare databasebrukeren (Edge-funksjonen) skal kunne kjøre synken, ikke API-et.
revoke execute on function public.synk_treningslogg(jsonb) from public, anon, authenticated;

-- Timesvis synk som sikkerhetsnett, i tillegg til GitHub Action etter hver push.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select cron.schedule(
  'synk-treningslogg',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://mtjwkcunpjgvagptuiet.supabase.co/functions/v1/synk-treningslogg',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
