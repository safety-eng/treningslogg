// Fast informasjon om bloggen og målet. Endre her, så oppdateres forsiden.
export const profil = {
  bloggnavn: 'Fredriks treningslogg',
  navn: 'Fredrik',
  beskrivelse:
    'Trening er terapi. En åpen logg fra en treningsreise gjennom tykt og tynt, med statistikk for hver økt.',
};

// Teksten øverst på forsiden.
export const hero = {
  tittel: 'Gjennom tykt og tynt',
  tekst:
    'Dette er loggen fra en reise gjennom skader og alt annet livet har bydd på, én økt av gangen.',
  bildeAlt: 'Løper i motlys langs Nidelva, med Nidarosdomen i bakgrunnen',
};

export const mal = {
  tittel: '10 km under 38:00',
  distanse_km: 10,
  tid: '38:00',
  // Navnet på planen i nye innlegg. Eldre innlegg beholder navnet de ble skrevet med.
  planNavn: '10 km under 38',
  uker: 10,
};

// Utgangspunktet målet måles mot.
export const referanse = {
  navn: 'Trondheim halvmaraton',
  distanse_km: 21.0975,
  tid: '1:27:40',
  ar: 2026,
};

// Nyhetsbrev via Buttondown. Påmeldingen går gjennom Supabase-funksjonen meld-pa.
export const nyhetsbrev = {
  url: 'https://mtjwkcunpjgvagptuiet.supabase.co/functions/v1/meld-pa',
  tittel: 'Få nye innlegg på e-post',
  tekst: 'Én e-post hver gang det kommer et nytt innlegg. Ingen reklame, og du kan melde deg av når som helst.',
  samtykke: 'Ja, jeg vil motta e-post fra Fredriks treningslogg når det kommer nye innlegg.',
};
