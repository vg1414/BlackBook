# Changelog

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
