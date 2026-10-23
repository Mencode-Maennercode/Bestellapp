# Product

<!-- impeccable:product-schema 1 -->

Derived from the confirmed decisions in `docs/v2-konzept.md` (user-approved plan, 2026-10-23).

## Platform

web

## Users

- **Guests** at a carnival session or club party (Karneval, Rhineland). Seated at numbered tables, phone in hand, loud room, dim stage light, often a drink or two in. They scan the QR code on their table and want a drink or the waiter without waving across the hall.
- **Waiters (Köbes)** of the hosting club, volunteers, no login. Moving fast between tables, one hand free.
- **Bar staff (Theke)** on a fixed tablet or phone behind the counter.
- **Organiser (Admin)** prepares the event, prices, tables and QR sheets, and reads the statistics afterwards.

## Product Purpose

Table ordering for one-night club events: guests order or call the waiter from their table, waiters and the bar see every order live, nothing gets lost, and the revenue statistics are exact to the cent. Success: every order reaches the table, nobody waits unseen, the organiser trusts the numbers.

## Positioning

Built for the carnival evening, not for restaurants: zero friction for guests (QR, no app, no account), link-only access for volunteer waiters, every event strictly isolated so codes stop working after the night.

## Operating Context

- Dark venue, loud music, short attention. Phones of every age and size, also older guests.
- Guests pay at the table (cash to the waiter); the app never handles payment.
- Kölsch dialect or Standard German per event (`language: koelsch | hochdeutsch`).
- Hosted as static files under `www.praesenzwert.de/Buchungssystem/`; backend Firebase.

## Capabilities and Constraints

- Guest: order from photo menu, glasses prompt for bottles, call waiter (5 min cooldown), live order status, banners for paused/shutdown/ended/broadcast.
- Prices always computed server-side; the client never sends prices.
- Club colours come from event settings (`accent.primary`, `accent.secondary`, default `#009640` / `#FFCC00`).
- Drink photos are brand-free (no logos, labels or brand names on images).

## Brand Commitments

- Presented by **PräsenzWert** (logo in `public/img/praesenzwert.png`); feedback popup for PräsenzWert stays.
- Design direction pinned by the user: "Nacht-Event Premium".

## Evidence on Hand

- Product photos: `public/img/drinks/*`, background `public/img/bokeh-dunkel.webp`.
- Legal texts (Impressum, Datenschutz) ported from the previous app.

## Product Principles

1. Nothing disappears unhandled: every order stays visible until it is done.
2. Zero friction for guests: one tap adds a drink, two taps send the order.
3. Honest numbers: money in integer cents, computed on the server.
4. Events are islands: codes and links die with the event.

## Accessibility & Inclusion

WCAG AA contrast, touch targets at least 48 px, `prefers-reduced-motion` respected, readable in dim light for older guests.
