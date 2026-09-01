# QNBA: zaštita petorki i API popravci

> Ovaj izvještaj opisuje prvi korak. Naknadna zaštita preostalih tablica i nove provjere opisane su u `security-completion.md`.

Primijenjeno 31. 8. 2026. na Supabase projekt `fdlcdiqvbldqwjbbdjhv`.

## Petorke

- RLS i prava u bazi dopuštaju korisniku samo čitanje i izmjene vlastitih aktivnih članstava. Anonimni pristup je zabranjen.
- Identitet člana nije moguće promijeniti. Duplikate blokira jedinstveni indeks; maksimalno 12 igrača provjerava se u bazi uz zaključavanje po vlasniku.
- Redoslijed se sprema jednim transakcijskim pozivom. Nepotpuni ili zastarjeli popis odbija se. UI vraća prethodni redoslijed ako spremanje ne uspije.
- Dodavanje na profilu, u preporukama i na stranici petorke koristi isti provjereni postupak. Brisanje potvrđuje da je redak stvarno obrisan; prikaz se ne mijenja unaprijed kao da je neuspješan zapis uspio.
- Od 50 zatečenih redaka sačuvano je svih 50: šest zapisa bez vlasnika/igrača ili duplikata arhivirano je, a 44 aktivna članstva ostaju dostupna vlasnicima. Arhivirane zapise vidi administrator.
- Javno se čitaju samo agregatni brojevi popularnosti, bez identiteta vlasnika i sadržaja njihovih petorki.

Tri primijenjene migracije su u `supabase/migrations`, s verzijama usklađenima s udaljenom bazom. Nemoj ih ponovno ručno primjenjivati na isti projekt.

## API i prikaz

- Most-searched i most-added vraćaju `count` koji dashboard očekuje; pogreške se razlikuju od praznih rezultata.
- Privatni `/api/dream-team` zahtijeva provjerenu prijavu, čita samo vlasnikove podatke i koristi `private, no-store`.
- Raspored koristi konačne modele LR/XGBoost, provjerava naziv modela i prikazuje jasnu poruku/retry nakon greške. Ne predstavlja lokalno spremljen raspored kao prijenos uživo.
- Ticker koristi ispravne identifikatore i ISO vrijeme; datum/vrijeme prikazuju se u istoj lokalnoj vremenskoj zoni.
- Uklonjen je ispis cijele prijavne sesije u konzolu. Service-role ključ koristi isključivo lokalni pipeline.

## Provjere

- `supabase/tests/dream_team_security.sql`: provjereni vlastiti/tuđi redci, lažni vlasnik, duplikat, null pozicija, promjena i brisanje tuđe ekipe, spremanje redoslijeda, zastarjeli popis, dvanaesti/trinaesti igrač, anonimni pristup i zabrana javnih pipeline upisa. Testovi se završavaju rollbackom.
- `node scripts/check-api.cjs`: lokalni popularni API-ji i raspored HTTP 200, ispravan ugovor podataka, nepoznati model 400, privatna petorka gosta 401 i zabrana cachea.
- `scripts/test_pipeline.py`: provjere nevaljanih podataka, JSON null vrijednosti, identifikatora/vremenske zone i istodobnog pokretanja.
- TypeScript i production build prolaze. U pregledniku provjereni dashboard s podacima i gostujući prikaz petorke. Prijavljeno dodavanje/drag-and-drop nije ručno provjereno stvarnim korisničkim računom; ovlasti i transakcije testirane su u bazi.

## Što ovo ne rješava

Ovo nije potpuni sigurnosni audit projekta. Supabase i dalje prijavljuje **19 drugih javnih tablica bez RLS-a**, uključujući user_interactions, searchstats, sadržajne i trening/backup tablice. Postoje i upozorenja o drugim funkcijama, GraphQL izloženosti i zaštiti lozinki. Njih treba pregledati prije komercijalne objave; ne treba naslijepo zatvoriti tablice i pokvariti postojeće funkcije.

[Supabase upute za tablice bez RLS-a](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).

Build također prijavljuje postojeću neuspjelu DNS vezu prema MongoDB klasteru, zastarjele browser podatke, middleware konvenciju i nedostajući metadataBase. MongoDB ovisne funkcije nisu dio ove provjere. Početna stranica `app/page.tsx` zadržana je s korisnikovim postojećim izmjenama, uključujući postojeći whitespace warning.

Frontend izmjene nisu još objavljene na Vercelu. Baza i Windows zadatak već su aktivni. Za operativne upute pogledaj `laptop-pipeline.md`.
