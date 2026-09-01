# QNBA: prvi razvojni pregled nakon povezivanja baze

> Povijesni pregled prije izmjena. Za naknadno primijenjenu zaštitu baze i prijenos skripti vidi `security-api-changes.md` i `laptop-pipeline.md`.

Datum: 2026-08-31. Ciljni projekt: `fdlcdiqvbldqwjbbdjhv`, organizacija
`IPVO_projekt_nastavak`. Baza nije mijenjana tijekom ovog pregleda.

## Potvrđeno u bazi

Točni brojevi iz `count(*)` (procjene popisa tablica nisu bile pouzdane):

| Tablica | Redaka |
| --- | ---: |
| Osnovno_NBA | 5105 |
| CurrentStats_NBA | 646 |
| FullStats_NBA | 4976 |
| UserDreamTeams | 50 |

- Od 27 javnih tablica, 26 nema RLS. Heatmap ima RLS, ali nema pravila.
- `anon` i `authenticated` imaju SELECT, INSERT, UPDATE i DELETE, među ostalim
  dozvolama, nad UserDreamTeams i user_interactions. Filtriranje po user_id u
  pregledniku nije sigurnosna zaštita.
- CurrentStats_NBA nema stupac sezone ili vremena osvježavanja. Nekoliko
  statističkih stupaca (npr. AST, STL i BLK) je tekstualnog tipa. Prije promjene
  tipova treba provjeriti vrijednosti i skripte koje pune tablicu.
- UserDreamTeams koristi user_id, player_id i position. Sučelje dopušta 12
  igrača: prvih pet i klupu. Ne mijenjati ga neprimjetno u ograničenje od pet.

## Prvi dovršeni zahvat: fotografije

- PlayerImage se koristi na dashboardu, profilu, usporedbi, petorkama, momčadi,
  preporukama, pretrazi i Guesseru.
- URL se određuje u lib/player-images.ts; neispravan ID ili neuspjelo učitavanje
  daje lokalnu SVG siluetu umjesto skrivanja elementa.
- Mali portreti koriste 260x190, veći 1040x760. Postojeći stilovi ostaju.
- Guesser više nema ime odgovora u alternativnom tekstu prije završetka niti
  zapis cijelog odgovora u konzoli. To NIJE zaštita od varanja: API i URL slike
  i dalje otkrivaju identitet igrača.
- Izvor je i dalje NBA CDN. Ovo ne rješava licencu. Budući katalog mora čuvati
  izvor, autora, licencu i dopuštene uporabe svake slike.
- Ako CDN vrati vlastitu zamjensku sliku uz uspješan HTTP odgovor, komponenta
  to ne može prepoznati kao pogrešku.

## Sljedeći paketi, po prioritetu

1. **Sigurnost korisničkih podataka.** Mapirati čitanja i pisanja petorki,
   preporuka i analitike. Pripremiti RLS pravila prema vlasniku i potrebne
   dozvole; provjeriti neprijavljenog korisnika, vlasnika i drugog korisnika.
   Posebno provjeriti agregacijske funkcije koje trebaju podatke više korisnika.
   Ne uključivati RLS bez odgovarajućih pravila na aktivnoj bazi.
2. **Dnevni Guesser.** Spremati dnevni zadatak kao stabilan zapis, definirati
   dan u UTC-u i spremanje pokušaja. Sadašnji izbor ovisi o nesortiranom skupu
   do 400 igrača pa se može promijeniti i tijekom dana. Odgovore provjeravati
   na poslužitelju prije rangiranja; ne slati identitet prije otkrivanja.
   Zatim dodati dijeljenje, povijest i niz odigranih dana.
3. **Pouzdanost petorki.** Obrađivati pogreške upisa i brisanja; trenutačno
   sučelje ažurira stanje bez provjere uspjeha. Promjenu redoslijeda napraviti
   atomskom te provjeriti duplikate i ograničenja na razini baze.
4. **Navigacija i početna.** Sačuvati postojeći izgled. Istaknuti dnevni izazov,
   pretragu i usporedbu; analitiku izdvojiti u zaštićeni administrativni dio.
5. **Podaci i profili.** Dodati podrijetlo, sezonu i datum osvježavanja;
   razdvojiti nedostajuće vrijednosti i stvarne nule, uključujući HOF procjene.

## Postojeća prepreka provjeri cijelog projekta

TypeScript provjera prije izmjena prijavljuje tri pogreške u
lib/highlights/queries.ts: uvoz iz praznog lib/supabaseServer.ts i dva implicitna
any parametra. Rješavati kao zaseban zahvat uz odluku treba li highlight dohvat
koristiti korisničku sesiju ili javni pristup; ne uvoditi service_role ključ kao
prečac. Korisnikova postojeća izmjena app/page.tsx ostavljena je netaknuta.

Provjera nakon izmjena: TypeScript prijavljuje iste tri pogreške, bez novih.
`git diff --check` prolazi za izmijenjene datoteke ovog zahvata (isključena je
postojeća korisnikova izmjena početne). Lokalni dashboard se kompilira i vraća
HTTP 200, ali most-searched, most-added i nba-schedule vraćaju HTTP 500 pa
prikazuje prazne liste. Uzrok tih API pogrešaka još nije utvrđen. Google font
se u ovom okruženju nije preuzeo i koristi se zamjenski font. Zato pregled
dashboarda nije puna vizualna potvrda portreta s podacima niti provjera svih
osam prikaza; to ostaje za test nakon popravka lokalnih API tokova.

Sigurnosne reference:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public
