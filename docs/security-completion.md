# Završetak zaštite baze i lokalnih provjera

Naknadna nadogradnja Guessera: [guesser-development.md](guesser-development.md). Odgovori i pokušaji sada su na serveru; ranije ograničenje s odgovorom u API-ju više ne vrijedi. Dodane su dvije privatne tablice s RLS-om (ukupno 30 javnih tablica).

Datum: 31. 8. 2026. Projekt: QNBA, `fdlcdiqvbldqwjbbdjhv`.

## Primijenjeno

- Svih **28 javnih tablica ima RLS**. Javni NBA podaci ostaju čitljivi; gost nema prava upisa ni u jednu javnu tablicu.
- Jedanaest pregledanih trening, backup i testnih tablica zatvoreno je za web-klijente. Postojeći servisni pristup i podaci nisu uklonjeni.
- `user_interactions` dopušta čitanje samo vlastitih radnji i unos samo uz vlastiti identitet, valjanog igrača, dopušteni događaj i ograničenu težinu. Klijent ne može prepisivati vrijeme, mijenjati ili brisati radnje.
- Analitika vraća samo zbirne rezultate prijavljenim korisnicima. Nema javnog čitanja tuđih korisničkih zapisa.
- Brojač pretraga prihvaća samo prijavljenog korisnika i poznatog igrača. Isti korisnik/igrač broji se najviše jednom u minuti, uz ograničenje od 30 različitih igrača u minuti. Gost i dalje može normalno pretraživati, ali ne povećava brojač.
- Popravljen je trigger popularnosti: stvarni PostgREST pozivi više ne zapinju na zabrani DELETE-a bez WHERE uvjeta. Brojači se osvježavaju bez potpunog brisanja tablice.
- API reakcija izvodi identitet iz provjerene prijave, ignorira identitet iz tijela zahtjeva i provjerava igrača/reakciju. MongoDB veza otvara se tek pri zahtjevu, s ograničenim čekanjem; kvar se prikazuje korisniku umjesto rušenja profila.
- Dnevna igra lokalno pamti pokušaje, hintove i završetak. Nakon završetka nema ponovnog pokretanja dnevnog izazova; practice ostaje ponovljiv. Dnevni izbor igrača ima stabilan poredak.
- Pretraga ignorira zastarjele odgovore i kontrolne znakove filtera. Evidencija radnje više ne odgađa odabir igrača. Petorke podržavaju i preslagivanje tipkovnicom.

Šira prva verzija migracije odbijena je automatskom sigurnosnom provjerom. Primijenjena verzija koristi izričit popis pregledanih tablica, **ne briše postojeće politike i ne mijenja zadane ovlasti budućih objekata**.

## Provjere

- `scripts/check-two-accounts.cjs`: dva stvarna privremena Auth računa, vlasništvo, pokušaj lažnog vlasnika, duplikati, preslagivanje, ponovno čitanje kroz Next API, brisanje, izolacija radnji i zbirna analitika.
- `supabase/tests/remaining_tables_security.sql`: zaštita svih javnih tablica, zabrana anonimnog pisanja, privatnost trening/backup tablica, funkcije analitike i deduplikacija brojača pretraga. Završava rollbackom; za dio provjera zahtijeva privremene testne račune.
- `scripts/check-api.cjs`: javni API-ji vraćaju očekivani oblik odgovora, pogrešan model odbija se, privatna petorka gosta vraća 401.
- TypeScript i production build prolaze. Posljednji build više ne pokušava uspostaviti MongoDB vezu tijekom uvoza modula.
- U pregledniku je potvrđeno dodavanje, preslagivanje tipkovnicom, trajnost redoslijeda nakon ponovnog učitavanja i brisanje u privremenoj ekipi. Četiri API-ja igre vraćaju valjanog igrača i statistike. Anonimno slanje reakcije odbijeno je s 401, a nedostupni MongoDB vraća kontrolirani 503.
- Nakon novih pravila ponovljen je read-only preflight pipelinea: pristup bazi i oba modela prošli su provjeru.
- U dnevnoj igri kroz preglednik je potrošen hint, a nakon osvježavanja ostali su sačuvani `Attempts: 1 / 6`, `Show hint (1/4)` i otkrivena pozicija.
- Windows zadatak prethodno je prošao puni prolaz; potvrđeno je `LastTaskResult=0`, sljedeći dnevni termin 1. 9. u 08:00. Automatsko pokretanje tog budućeg termina još se nije moglo provjeriti.

Privremene račune nakon provjere uklanja `node scripts/check-two-accounts.cjs --cleanup`. Skripta briše samo račune koje je sama evidentirala u ignoriranom `logs/security-test-accounts.json` i njihove testne retke, ne postojeće korisnike.

Čišćenje je izvršeno: globalne testne sesije opozvane su, oba privremena računa uklonjena su, datoteka s testnim lozinkama izbrisana je, a baza potvrđuje nula preostalih testnih računa i svih 50 izvornih zapisa petorki. U sučelju drugog računa prikazala se njegova zasebna ekipa, bez igrača prvog računa.

## Preostala ograničenja

- **Git/push i Vercel objava odgođeni su prema korisnikovoj uputi.** Baza je ažurirana, a frontend i API izmjene su lokalno. Deployed stari frontend još ne sadrži prilagodbe novih ovlasti.
- Postojeći MongoDB klaster za reakcije nije dostupan. Sigurnost i obrada pogreške popravljene su, ali stvarno spremanje reakcija zahtijeva ispravnu MongoDB vezu; stari podaci nisu brisani niti zamijenjeni praznom bazom.
- Dnevni napredak sprema se samo u tom pregledniku. To nije poslužiteljska zaštita od varanja: cilj igre i dalje dolazi u API odgovoru. Rang-listu ili nagrade ne treba graditi na ovom klijentskom stanju.
- Supabase više ne prijavljuje tablice bez RLS-a ni promjenjiv search_path naših javnih funkcija. Ostaju obavijesti o namjerno vidljivim GraphQL objektima s kontroliranim pristupom te isključenoj zaštiti od procurjelih lozinki. Postavke Autha nisu mijenjane.
- Ovo ne rješava prava korištenja fotografija, kvalitetu predikcijskih modela niti sve buduće zahtjeve komercijalizacije.

[Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Vidljivost GraphQL objekata](https://supabase.com/docs/guides/database/database-linter?lint=0026_pg_graphql_anon_table_exposed) · [Zaštita lozinki](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
