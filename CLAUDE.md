# Black Book – CLAUDE.md

En pokerapp för att spåra skulder och saldon i en spelgrupp.
Live på GitHub Pages via repot `vg1414/BlackBook`.

---

## Appens syfte

Spelarna går med i en **grupp** via en gruppkod. Under en **session** registreras vad varje spelare vinner/förlorar (i poäng eller kronor). Appen räknar ut saldon och föreslår hur pengar ska betalas med så få transaktioner som möjligt.

---

## Filstruktur

```
index.html          – All HTML: skärmar, modaler, nav
style.css           – All CSS
app.js              – Huvudlogik: state, events, initiering, routing
sw.js               – Service Worker (PWA offline-cache)
manifest.json       – PWA-manifest (ikon, namn, theme-color)
favicon.png
apple-touch-icon-180x180.png
nanobanana.png      – Används som ikon i appen (laddningsindikator e.d.)
seed-test.html      – Testfil för att seeda testdata i Firebase

modules/
  firebase.js       – All Firebase-kommunikation (Realtime Database)
  session.js        – Sessionslogik: registrera ronder, avsluta session
  settlement.js     – Algoritm för att minimera betalningar + formatering
  ui.js             – DOM-renderingsfunktioner
```

---

## Skärmar (screens)

| ID                  | Beskrivning                                         |
|---------------------|-----------------------------------------------------|
| `screen-lobby`      | Startskärm: gå med i grupp eller skapa ny           |
| `screen-dashboard`  | Saldoöversikt, sessioner, transaktioner             |
| `screen-session`    | Aktiv session: snabbregistrering av rundor          |
| `screen-history`    | Historik över alla sessioner                        |
| `screen-stats`      | Statistik per spelare                               |

Navigering sker via bottom nav (`#bottom-nav`) och `showScreen(id)` i `ui.js`.

---

## Modaler

| ID                       | Syfte                                              |
|--------------------------|----------------------------------------------------|
| `modal-create-name`      | Skapa grupp: gruppnamn + ditt namn                 |
| `modal-new-session`      | Starta ny session: namn, poängvärde, spelare       |
| `modal-group`            | Gruppinställningar: kod, spelare, lämna/radera     |
| `modal-session-settings` | Sessionsinställningar: namn, poängvärde            |
| `modal-session-detail`   | Detaljer för en avslutad session                   |
| `modal-chart`            | Diagram + stats för aktiv session (Chart.js)       |

---

## State-objekt (app.js)

```js
const state = {
  groupCode,        // string, t.ex. "ABC123"
  playerId,         // string, Firebase push-key
  playerName,       // string
  players,          // { [id]: { name } }
  sessions,         // { [id]: { name, status, pointValue, ... } }
  balances,         // { [playerId]: netBelopp i öre }
  totals,           // { [playerId]: ackumulerat saldo (stängda sessioner) }
  entries,          // { [id]: { sessionId, playerId, amount, type } }
  confirmations,    // { [id]: { from, to, amount, ... } }
  activeSessionId,  // string | null
  unsubscribers,    // Firebase-lyssnare att städa vid logout
  newSessionSelectedPlayers // valda spelare vid sessionstart
}
```

---

## Firebase-datamodell (Realtime Database)

```
groups/
  {groupCode}/
    meta/           name
    players/        { [playerId]: { name } }
    sessions/       { [sessionId]: { name, status, pointValue, ... } }
    entries/        { [entryId]: { sessionId, playerId, amount, type } }
    balances/       { [playerId]: netBelopp i öre }
    totals/         { [playerId]: ackumulerat saldo i öre }
    confirmations/  { [confId]: { from, to, amount, confirmedAt } }
```

---

## Viktiga moduler

### `modules/firebase.js`
Exporterar alla Firebase-operationer: `createGroup`, `addPlayer`, `createSession`, `addEntry`, `closeSession`, `listenBalances`, `listenTotals`, `confirmTransaction`, `deleteGroup`, m.fl.

### `modules/settlement.js`
- `minimizePayments(balances)` – Greedy-algoritm för att minimera antal transaktioner
- `sekToOre(sek)` / `oreToSek(ore)` – Konvertering (appen lagrar alltid i öre)
- `formatAmount(ore)` / `formatPoints(ore, pointValue)` – Formatering för visning

### `modules/session.js`
- `submitQuickResults(groupCode, sessionId, amounts)` – Registrera en runda (zero-sum-validering)
- `endSession(groupCode, sessionId)` – Stäng session, räkna om totaler
- `undoEntry(groupCode, entryId)` – Ångra senaste post

### `modules/ui.js`
Renderingsfunktioner för alla listor och vyer:
`renderBalances`, `renderSettlements`, `renderConfirmedTransactions`,
`renderActiveSessionPreview`, `renderClosedSessionsOnDashboard`,
`renderQuickMode`, `renderHistory`, `renderSessionDetail`,
`renderGroupPlayers`, `renderSessionPlayerSelect`, `renderStats`,
`buildSessionStatsHTML`, `renderTotals`

---

## PWA

- `manifest.json` + `sw.js` ger offline-stöd och installerbarhet
- `theme-color: #d4af37` (guld)
- Typsnitt: Playfair Display + Caveat (Google Fonts)

---

## Övrigt

- Alla belopp lagras i **öre** (heltal) internt för att undvika floating point-fel
- Sessioner kan vara `status: "active"` eller `status: "closed"`
- Gruppkod är alltid versaler (max 10 tecken), genereras automatiskt
- Lokalt sparas `groupCode`, `playerId`, `playerName` i localStorage (stöd för flera grupper)
