# Changelog

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
