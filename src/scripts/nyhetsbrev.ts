import { nyhetsbrev } from '../data/profil.mjs';

// Husker valget til besøkende i nettleseren (lagring kan være blokkert, så alt er i try/catch).
const NOKKEL = 'nyhetsbrev';
const PAUSE_DAGER = 30;
function les(): { status?: 'pameldt' | 'avvist'; tid?: number } {
  try { return JSON.parse(localStorage.getItem(NOKKEL) ?? '{}'); } catch { return {}; }
}
function lagre(status: 'pameldt' | 'avvist') {
  try { localStorage.setItem(NOKKEL, JSON.stringify({ status, tid: Date.now() })); } catch { /* ignorer */ }
}

function koblSkjema(skjema: HTMLFormElement) {
  const melding = skjema.querySelector<HTMLElement>('.melding')!;
  const knapp = skjema.querySelector<HTMLButtonElement>('.send')!;
  const vis = (tekst: string, type: 'ok' | 'feil') => { melding.textContent = tekst; melding.dataset.type = type; };

  skjema.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fornavn = skjema.elements.namedItem('fornavn') as HTMLInputElement;
    const epost = skjema.elements.namedItem('epost') as HTMLInputElement;
    const samtykke = skjema.elements.namedItem('samtykke') as HTMLInputElement;
    const nettside = skjema.elements.namedItem('nettside') as HTMLInputElement;
    for (const f of [fornavn, epost]) f.removeAttribute('aria-invalid');
    samtykke.closest('label')!.removeAttribute('data-feil');

    // Sjekk i nettleseren først, så besøkende får svar med en gang.
    if (!fornavn.value.trim()) { fornavn.setAttribute('aria-invalid', 'true'); fornavn.focus(); return vis('Skriv inn fornavnet ditt.', 'feil'); }
    if (!epost.validity.valid || !epost.value.trim()) { epost.setAttribute('aria-invalid', 'true'); epost.focus(); return vis('Sjekk at e-postadressen er riktig.', 'feil'); }
    if (!samtykke.checked) { samtykke.closest('label')!.setAttribute('data-feil', 'true'); samtykke.focus(); return vis('Kryss av for at du vil motta e-post.', 'feil'); }

    knapp.disabled = true;
    vis('Melder deg på …', 'ok');
    try {
      const r = await fetch(nyhetsbrev.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornavn: fornavn.value, epost: epost.value, samtykke: true, nettside: nettside.value }),
      });
      const svar = await r.json().catch(() => ({ ok: false }));
      if (svar.ok) {
        lagre('pameldt');
        skjema.classList.add('ferdig');
        vis(svar.status === 'finnes'
          ? 'Du er allerede på listen. Har du ikke bekreftet ennå, ligger lenken i innboksen din.'
          : `Takk, ${fornavn.value.trim()}! Sjekk innboksen din og klikk på lenken for å bekrefte påmeldingen.`, 'ok');
      } else {
        if (svar.felt === 'epost') epost.setAttribute('aria-invalid', 'true');
        if (svar.felt === 'fornavn') fornavn.setAttribute('aria-invalid', 'true');
        vis(svar.feil ?? 'Noe gikk galt. Prøv igjen om litt.', 'feil');
      }
    } catch {
      vis('Fikk ikke kontakt. Sjekk nettforbindelsen og prøv igjen.', 'feil');
    } finally {
      knapp.disabled = false;
    }
  });
}

function startPopup() {
  const dialog = document.getElementById('nyhetsbrev-popup') as HTMLDialogElement | null;
  if (!dialog || typeof dialog.showModal !== 'function') return;
  if (location.pathname.startsWith('/personvern')) return;

  const lagret = les();
  if (lagret.status === 'pameldt') return;
  if (lagret.status === 'avvist' && Date.now() - (lagret.tid ?? 0) < PAUSE_DAGER * 86400000) return;

  // Ikke vis popupen hvis påmeldingsfeltet på siden allerede er synlig eller i bruk.
  const seksjon = document.getElementById('nyhetsbrev');
  let seksjonSynlig = false;
  let seksjonBrukt = false;
  if (seksjon) {
    new IntersectionObserver((e) => { seksjonSynlig = e[0].isIntersecting; }, { threshold: 0.3 }).observe(seksjon);
    seksjon.addEventListener('focusin', () => { seksjonBrukt = true; });
  }

  const start = Date.now();
  let vist = false;
  const lukk = () => { if (les().status !== 'pameldt') lagre('avvist'); dialog.close(); };
  dialog.querySelectorAll('[data-lukk]').forEach((b) => b.addEventListener('click', lukk));
  dialog.addEventListener('cancel', () => { if (les().status !== 'pameldt') lagre('avvist'); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) lukk(); });

  const sjekk = () => {
    if (vist || seksjonSynlig || seksjonBrukt || les().status) return;
    const lest = (window.scrollY + innerHeight) / document.documentElement.scrollHeight;
    const sekunder = (Date.now() - start) / 1000;
    if (sekunder >= 45 || (lest >= 0.55 && sekunder >= 15)) {
      vist = true;
      dialog.showModal();
    }
  };
  addEventListener('scroll', sjekk, { passive: true });
  const timer = setInterval(() => { sjekk(); if (vist) clearInterval(timer); }, 5000);
}

export function startNyhetsbrev() {
  document.querySelectorAll<HTMLFormElement>('form[data-nyhetsbrev]').forEach(koblSkjema);
  startPopup();
}
