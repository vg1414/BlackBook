# Black Book – Skuldboken

En PWA-app för att hålla reda på skulder, vinster och förluster bland en grupp vänner under spelkvällar (poker, sport, kortspel m.m.).

## Funktioner

- **Realtidssynk** via Firebase Realtime Database – alla i gruppen ser uppdateringar direkt
- **Ingen inloggning** – dela en 6-teckens gruppkod med dina vänner
- **Snabbläge** – ange direkt +/- belopp per spelare (nollsumma-validering)
- **Buy-in-läge** – registrera buy-in, rebuys och cashout per spelare
- **Smart uppgörelse** – minimerar antal transaktioner (greedy-algoritm)
- **Historik** – alla avslutade sessioner sparas permanent
- **Statistik & Duell** – gruppens rekord (höjdpunkter), summerad statistik per spelare över alla sessioner (vunna/förlorade rundor, streak, snitt, topp/botten) och jämförelse mellan två spelare
- **Diagram** – utveckling per session och över alla sessioner
- **Soft delete** – ångra transaktioner utan att förlora historik
- **PWA** – lägg till på hemskärm på iPhone och Android

## Tech Stack

- Vanilla HTML/CSS/JS (ES Modules)
- Firebase Realtime Database (Spark-plan)
- PWA: manifest + service worker

## Design

Svart läderbok med guldpressning (#110e0b / #d4af37), mobilfirst. Grundstil i `style.css`, visuell uppfräschning i `refresh.css`.

## Kom igång

1. Öppna [appen](https://vg1414.github.io/BlackBook/)
2. Skapa en ny grupp – du får en 6-teckens kod
3. Dela koden med dina vänner
4. Starta en session och börja spela!

## Lägg till på hemskärm

**iPhone:** Safari → Dela-knappen → "Lägg till på hemskärmen"
**Android:** Chrome → Menyn (⋮) → "Lägg till på startskärmen"
