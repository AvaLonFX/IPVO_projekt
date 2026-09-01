# QNBA: prijenos automatizacije na laptop

Postavljeno i provjereno 31. 8. 2026. u `C:\Users\AvaLon\my-app`.

## Što je instalirano

- Zasebni Python 3.13 u `.venv-pipeline`, s verzijama iz `requirements-pipeline.lock.txt`.
- Privatna konfiguracija `.env.pipeline.local`; nije u Gitu. Koristi postojeći service-role ključ ovog QNBA projekta, nikad ključ u pregledniku.
- Windows zadatak **QNBA Daily Pipeline**: svaki dan u **08:00 po lokalnom vremenu**, odnosno nakon prijave ako taj dan nije dovršen uspješan prolaz.
- Do tri ponovna pokušaja nakon pogreške, u razmacima od 30 minuta. Pojedini korak ima dva pokušaja i ograničeno trajanje. Dvije kopije ne mogu istodobno osvježavati podatke.
- Aktivne dnevne skripte više nemaju putanje do prijateljeva računala niti hardkodirane ključeve. Stari JS/bat ulazi preusmjeravaju na novi runner.

Laptop mora biti uključen, spojen na internet i korisnik prijavljen u Windows. Zaključan ekran je u redu. Buđenje je uključeno u postavkama zadatka, ali ovisi o podršci i postavkama napajanja; ugašen laptop se ne može sam pokrenuti. Nije potrebno otvarati editor, terminal ili web-stranicu.

## Redoslijed i izvori

1. `fetch_nba_schedule.py`: standardni NBA Stats ScheduleLeagueV2 endpoint, umjesto neispravnog CDN URL-a.
2. `update_nba_players.py`: NBA statistike i podaci o igračima; odabrana polja, čišćenje praznih brojčanih vrijednosti i skupni upisi.
3. `fetch_team_game_logs.py`: utakmice odabrane sezone, bez svakodnevnog ponavljanja svih prošlih sezona.
4. ESPN dostupnost igrača.
5. Postojeći LR/XGBoost modeli i zapis prognoza.

Dostupnost i prognoze obrađuju **regularnu sezonu u idućih sedam dana**. Ne prenose današnje ozljede na utakmice mjesecima unaprijed, niti stvaraju predsezonske prognoze modelima temeljenim na regularnoj sezoni. Kvar preduvjeta zaustavlja ovisni korak i cijeli prolaz označava neuspješnim. Time se izbjegava novi zapis prognoze nakon neuspjelog osvježavanja podataka. Postojeći zapisi se ne brišu.

Aktualna konfiguracija: statistike `NBA_SEASON=2025-26`, raspored `NBA_SCHEDULE_SEASON=2026-27`. Kada počne regularna sezona 2026./27. i postanu dostupne prve statistike, promijeni `NBA_SEASON` na `2026-27` i provjeri jedan puni prolaz. Sezone nisu automatski izmiješane. Stare retke CurrentStats tablice koji nisu vraćeni u novom odgovoru ne brišemo; potpuno razdvajanje statistike po sezonama ostaje zaseban posao.

## Ručno pokretanje i provjera

Iz korijena projekta:

```powershell
.\run_daily_pipeline.bat --check
.\run_daily_pipeline.bat
.\run_daily_pipeline.bat --only schedule
.\run_daily_pipeline.bat --only players
Get-Content .\logs\pipeline-status.json
Get-ScheduledTaskInfo -TaskName 'QNBA Daily Pipeline'
```

`--check` provjerava konfiguraciju, čitanje baze i učitavanje/predikciju oba modela bez upisa. Puni ručni prolaz uvijek osvježava; Windows launcher preskače dan koji već ima puni uspješan prolaz.

`logs/pipeline-status.json` sadrži rezultat zadnjeg pokretanja, korake, sezone i putanju dnevnika. `pipeline-last-success.json` pamti zadnji puni uspjeh. Dnevnici pojedinačnih prolaza su `pipeline-*.log`; greške samog launchera su u `launcher*.log`. Dnevnici nisu u Gitu; povremeno ukloni stare ako se nakupe.

Za ponovno postavljanje zadatka nakon premještanja mape pokreni `scripts/install-daily-task.ps1`. Virtualno Python okruženje tada ponovno kreiraj u novoj putanji:

```powershell
py -3.13 -m venv .venv-pipeline
.\.venv-pipeline\Scripts\python.exe -m pip install -r requirements-pipeline.lock.txt
.\scripts\install-daily-task.ps1
```

## Dokaz provjere

Puni prolaz 31. 8. 2026. završio je uspješno: 1.272 utakmice rasporeda, 582 zapisa statistike, 5.208 biografskih zapisa i 2.460 zapisa utakmica po momčadi. Svih pet koraka završilo je bez pogreške.

Ponovljen je i puni prolaz pokrenut izravno kroz Windows Task Scheduler: završen u 13:40 po lokalnom vremenu, `LastTaskResult=0`. Sljedeći dnevni termin je 1. 9. 2026. u 08:00. Time je provjereno pokretanje izvan terminala/editora, ne samo ručni poziv skripte.

Za idućih sedam dana nije bilo utakmica regularne sezone, pa dostupnost i prognoze nisu imale nove retke za zapis. Zasebno je provjereno parsiranje 77 ESPN zapisa ozljeda te učitavanje i konačnost izlaza oba modela. Time nije potvrđena kvaliteta predviđanja niti puni upis buduće prognoze s aktualnom utakmicom.

## Stari računalo, GitHub i objava

Raspored u lokalnom GitHub workflowu uklonjen je; ručno pokretanje ostaje. **Ta promjena još nije poslana na GitHub.** Nemamo pristup prijateljevu Windows rasporedu da ga fizički ugasimo.

U bazi su javnim i prijavljenim web-klijentima ukinuti upisi u šest tablica koje pipeline osvježava. Stari pronađeni skripti s anonimnim ključem zato više ne mogu pisati u njih. Ako prijatelj ima i service-role ključ ili administratorski pristup računu, ovo mu ne ukida taj pristup; za potpuno razdvajanje pristupa treba rotirati ključeve i pregledati članstvo u organizaciji.

Baza je već izmijenjena, a kod je još lokalno: nije napravljen commit, push ni Vercel deployment. Web-aplikacija i dalje može biti na Vercelu; ovaj Windows zadatak zamjenjuje računalo koje puni bazu, ne web-hosting.
