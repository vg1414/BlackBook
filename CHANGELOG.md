# Changelog

## 2026-04-15 (uppdatering 32)
- Fix: Stäng-knappen (✕) i session-detail-modalen försvann när man scrollade – gjord sticky så den alltid syns

## 2026-04-15 (uppdatering 31)
- Feature: "Gruppens totaler" – hopfällbar panel på dashboarden som visar ackumulerat saldo per spelare över alla stängda sessioner
- Feature: Totalen räknas om automatiskt vid sessionsstängning och radering
- Feature: Bootstrap-logik – om `/totals/` saknas i Firebase körs `recalcTotals` automatiskt vid inladdning

## 2026-04-15 (uppdatering 30)
- UX: "Totalt spelade" borttaget från Höjdpunkter i chart-modal (visas redan i meta-raden)
- UX: chart-modal stats-vy komprimerad (sd-body--compact) – mindre text/padding/avatarer men fortfarande läsbart per iOS/Android-standard
- Feature: exakt samma stats som stängd session (Resultat, Höjdpunkter, Per spelare) visas i aktiv sessions diagramknapp

## 2026-04-15 (uppdatering 29)
- Feature: diagramknappens stats-flik visar nu samma innehåll som en stängd session – Resultat, Höjdpunkter (streak, bästa runda, sessionsvinnare), Per spelare
- UX: stats-fliken öppnas som standard (inte diagram), flikordning ändrad till Stats | Diagram

## 2026-04-15 (uppdatering 28)
- Feature: diagram-modalen har nu två flikar – Diagram och Stats
- Stats-fliken visar totalt saldo, topp och botten per spelare för aktiv session

## 2026-04-15 (uppdatering 27)
- Fix: scrollning i session-skärmen fungerar nu på mobil (touch-action: pan-y på scroll-area)
- Fix: scrollning i övriga skärmar (Saldo, Historik, Statistik) fick samma fix
- Fix: scroll-i-scroll i session-detaljmodal borttagen (detail-entries-list begränsade inte längre listan)
- Feature: Statistik visar nu högsta och lägsta löpande saldo per spelare (grön/röd färgkodning)

## 2026-04-15 (uppdatering 25)
- UX: spelarrader komprimerade – padding från 7px→4px, gap från 6px→4px, avatar från 36px→28px, inputhöjd 34px
- UX: touch-yta på +/− behålls (44px via ::after pseudo-element) trots att knappen syns mindre
- UX: spelarnamnets font-size sänkt till 14px för kompaktare rad

## 2026-04-15 (uppdatering 24)
- Fix: trycka − på tom input sparar nu "pending sign" – siffror som skrivs in efteråt blir automatiskt negativa
- UX: negativa belopp visas i rött, positiva i vitt – lättare att se om man råkat ange fel tecken
- Fix: färg och tecken återställs till standard efter att en omgång skickas in

## 2026-04-15 (uppdatering 23)
- Fix: gruppnamn hämtas nu från Firebase och sparas lokalt när man joinar på en ny enhet
- Fix: gruppnamnet visas nu i dashboard-headern (ersätter "Black Book")
- Fix: gruppkoden visas inte längre felaktigt som gruppnamn – gamla grupper utan namn faller tillbaka till "Black Book"
- Fix: CSS-specificitet för amber-gradient på gruppnamn löst – korrekt guld-färg på alla enheter

## 2026-04-15 (uppdatering 22)
- Fix: +/- knapp bredvid varje inmatningsfält så man kan ange minusvärden på iPhone (där tangentbordet saknar minustecken)
- Fix: Summa-raden byter nu enhet (kr/p) direkt när man trycker på växla-knappen

## 2026-04-14 (uppdatering 21)
- Feature: modaler är nu swipebara – dra nedåt för att stänga, modalen följer fingret och glider ut ur botten

## 2026-04-14 (uppdatering 20)
- Feature: gruppnamn – sätts obligatoriskt vid skapandet, visas i mitten i "Dina grupper"-listan (kod till vänster, ditt namn till höger)
- Fix: uppgörelse visar nu alltid kr i alla update-vägar när pointValue är satt

## 2026-04-14 (uppdatering 19)
- Fix: förslag till uppgörelse visar nu alltid kr (inte p) när poängvärde är satt – `onPlayersUpdate` och `onConfirmationsUpdate` skickade inte med `pointValue`

## 2026-04-14 (uppdatering 18)
- Fix: session-sticky-total rensas nu korrekt vid early-return (ingen session / inga entries), förhindrar att spelare från en tidigare session visas i totalsumma-raden

## 2026-04-14 (uppdatering 17)
- UX: kr/p-switchen i sessiondetalj-modalen flyttad till höger på meta-raden (rundor/tid) – långt ifrån stäng-knappen, naturlig plats i flödet

## 2026-04-14 (uppdatering 16)
- Fix: header-avskärning – `height` → `min-height` med korrekt padding-top för safe-area/notch
- UX: ångra-knapp (↩) i marginalen på senaste omgången i anteckningsblocket

## 2026-04-14 (uppdatering 15)
- UX: animationer – screen-transitions, staggerade listor, ripple på knappar, spring-animationer
- UX: lobby – logo faller in med studs, kort glider upp, guld-glöd i bakgrunden
- UX: bottom nav – guld-pill-indikator, aktiv ikon skalas upp
- UX: FAB – pulserar med guld-glöd, gradient
- UX: toast – slide-in med backdrop blur
- UX: modaler – backdrop blur på overlay, rundare hörn
- UX: inputs – guld-glow vid fokus
- UX: header och bottom nav – glassmorphism (blur-bakgrund)
- UX: touch-targets uppgraderade till 44px minimum (Apple HIG)
- Fix: lade till `mobile-web-app-capable` meta-tag för Android PWA
- Fix: raderade oanvända icon-192.png och icon-512.png

## 2026-04-14 (uppdatering 14)
- Fix: stavning "Grupptinställningar" → "Gruppinställningar"
- UX: "Kopiera länk"-knapp även i gruppinställningarna

## 2026-04-14 (uppdatering 13)
- UX: "Kopiera länk"-knapp i sessionsinställningar – kopierar en join-länk med gruppkoden inbakad (?join=KOD)
- UX: deep link-stöd – om man öppnar appen med ?join=KOD fylls koden i automatiskt och namnsteget visas direkt

## 2026-04-14 (uppdatering 12)
- Fix: poängvärde i kr förifyllt korrekt när sessionsinställningar öppnas (|| → ?? för att inte missa värdet 0)
- UX: gruppkod visas och kan kopieras direkt från sessionsinställningarna

## 2026-04-14 (uppdatering 11)
- UX: papperskorgen borttagen från session-headern (radering sker via kugghjulet)
- UX: kr/p-switchen flyttad till bredvid Registrera-knappen istället för i headern
- UX: anteckningsblocket visas alltid direkt när sessionen öppnas, inte bara efter första registrering

## 2026-04-14 (uppdatering 10)
- Fix: SW v8 – alla /BlackBook/-paths bytta till / för att matcha Cloudflare-hosting
- Fix: manifest.json start_url och scope uppdaterade till /

## 2026-04-14 (uppdatering 9)
- Fix: SW v6 – cacheinstallation kraschar inte längre om en enstaka fil saknas

## 2026-04-14 (uppdatering 8)
- Fix: borttaget felaktigt anrop till renderBuyinMode (funktionen finns inte längre)
- UX: anteckningsblocket syns alltid, även innan första rundan registrerats
- UX: p/kr-switchen flyttad till session-headern (aldrig i vägen för innehållet)
- UX: inputfält börjar tomma istället för "0" – enklare att föra score
- UX: namnraden längst ner layoutas smart per antal spelare (2→2 kol, 3→3, 4→2+2, 5→3+2)

## 2026-04-14 (uppdatering 7)
- Session: spelarregistreringen är nu sticky – bara historiken under scrollar
- Diagram: visar poäng (p) eller kronor (kr) baserat på sessionens inställning
- Anteckningsblock-look på rundhistoriken (session-rounds-list)
- Registreringsdelen återställd till tidigare utseende

## 2026-04-14 (uppdatering 6)
- 2-spelarläge: nytt anteckningsblock-gränssnitt – ange belopp och tryck på vinnaren
- Skrivstilsfont (Caveat) på siffror och spelarnamn i registreringen
- Fix: service worker bumpad till v3 för att tvinga om iOS PWA-cache

## 2026-04-14 (uppdatering 5)
- 2-spelarläge: tryck på den nedre spelaren för att byta vem som är plus (inputfältet)

## 2026-04-14 (uppdatering 4)
- Stäng-knappar ersatta med X i höger hörn på alla modaler
- Ny sessionsinställningsmodal (⚙) för namn och poängvärde direkt i sessionen
- Modaler har nu slide-up-animation och swipe-to-close-gest
- Omvänd historikordning i session: nyaste rundan visas överst
- 2-spelarläge: visar bara vinnarens namn per runda
- Sticky totalrad längst ner med grid-layout – fungerar snyggt för 5 spelare

## 2026-04-14 (uppdatering 3)
- Sticky totalrad redesignad: grid-layout med färgprick, namn och värde per spelare
- Hanterar 5+ spelare utan att bli trång

## 2026-04-14 (uppdatering 2)
- Poängläge: sessioner visar poäng istället för kronor
- Poängvärde (kr/poäng) kan anges vid sessionstart och justeras i efterhand
- Saldo visar kronor om poängvärde är satt, annars poäng
- Historik och uppgörelser visar rätt enhet baserat på poängvärde
- Registreringshistorik visas under Registrera-knappen i sessionen
- Tagit bort +/− knappar – bara direktinmatning av siffror
- 2-spelarläge: bara ett fält, motspelaren speglas automatiskt
- Inputfältet markeras automatiskt vid sessionstart

## 2026-04-14
- Spara flera grupper lokalt – alla grupper du är med i visas på startskärmen
- Klicka direkt på en sparad grupp för att gå med igen utan att skriva kod
- Radera grupp permanent (bara synligt för den som skapade gruppen, dubbel bekräftelse)
- Fix: "Hem"-knappen lämnar inte gruppen längre – gruppen finns kvar i listan
- Fix: Namnfält visas direkt när man klickar "Gå med" med förifylld kod

## 2026-03-26
- Diagram: tooltip-färgruta och legend-ruta är nu solid ifylld i spelarens färg

## 2026-03-25 (uppdatering 3)
- Namnfältet döljs tills giltig gruppkod angetts
- Dropdown med befintliga spelarnamn vid join – undviker dubblettnamn
- Ny modal för namnval när man skapar en ny grupp
- ⌂-knapp i headern för att snabbt komma till startskärmen
- Gruppkodsfältet visar alltid versaler
- Belopps-inputfält fixad bredd (72px) – ryms 4-siffriga belopp
- Seed-skript uppdaterat: 5 spelare (Hefner, Bullen, Traxen, Dawod, Majscht), 50 rundor, datum 2026-03-24

## 2026-03-25 (uppdatering 2)
- Bekräfta transaktioner i Uppgörelse med ✓-knapp och bekräftelsedialog
- Ny sektion "Bekräftade transaktioner" med möjlighet att ångra
- Bekräftelser sparas permanent i Firebase för alla i gruppen
- "Stäng" på sessionsskärmen döpt till "Avsluta session"

## 2026-03-25
- Linjediagram-vy per spelare (📈-knapp i aktiv session), uppdateras löpande
- 25kr steg istället för 50kr i +/–-knapparna
- "(Du)" – stor D och större textstorlek
- Alla amount-input lika breda, högerjusterade, ingen zoom på iPhone/Android
- Möjlighet att fortsätta stängda sessioner (Historik → Fortsätt)
- Radera sessioner med bekräftelsedialog (aktiva via 🗑-knapp, stängda i historik)
- "Snabb"-text borttagen genomgående

## 2026-03-24
- Rensat bort poker/buy-in/cashout/rebuy – enda sessionstyp är nu Snabb
- Sessionsnamn finns kvar (valfritt) men typval borttaget
- Ta bort spelare via ✕-knapp i grupptinställningar

## 2026-03-24 (redesign)
- Helt ny design: brutalistisk kortlek-estetik (svart/vitt, hård typografi)
- Nya typsnitt: Bebas Neue (display) + DM Mono + DM Sans
- Aktiv session visas som prominent banner överst i dashboard
- Historik nedprioriterad visuellt – numrerade rader
- Modaler: helbredd sheet med tjock topborder
- FAB: fyrkantig med shadow-offset för grafisk känsla
- Borttaget guld-tema, ersatt med kritvitt på kolsvart + blodrött

## 2026-03-24
- Initial release: Black Book PWA
- Firebase Realtime Database-integration med realtidssynk
- Lobby/Join-skärm med gruppkod (6 tecken) och spelarnamn
- Dashboard med saldo per spelare och uppgörelseförslag
- Snabbläge (+/-) med nollsumma-validering
- Buy-in-läge med rebuys och cashout
- Smart uppgörelsealgoritem (minimerar transaktioner)
- Historik över avslutade sessioner
- Grupptinställningar: lägg till spelare, kopiera kod
- PWA: manifest.json + service worker (cache-first)
- Svart/guld design, mobilfirst, iOS safe-area-stöd
- Soft delete (ångra transaktioner)
