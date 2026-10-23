# Design System: Nacht-Event Premium

Built for one scene: a dark carnival hall, loud, phones in hand. Tokens live in `src/styles/app.css`, components in `src/ui/`.

## Colour

| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0D0B` | page (near-black with a green cast) |
| `surface-1/2/3` | `#111613` / `#182019` / `#212A23` | cards / sheets, cart / inputs, steppers, secondary buttons |
| `--edge` | `inset 0 1px 0 rgb(236 255 243 / .07)` | fine light edge on every raised surface (no borders, no drop-shadow cards) |
| `ink` / `ink-2` / `ink-3` | `#EEF3EF` / `#AAB6AE` / `#85928A` | text levels, all ≥ 4.5:1 on surfaces |
| `accent` | event `accent.primary` (default `#009640`) | primary action, progress |
| `accent-2` | event `accent.secondary` (default `#FFCC00`) | "in the cart" state, focus ring, broadcast, selection |
| `warn` / `late` / `ok` | `#F0A63A` / `#FF5D55` / `#4FD88A` | urgency and status |

Club colours are applied at runtime (`applyAccent`); text on them picks near-black or near-white by WCAG contrast. A 4 px two-colour band (primary | secondary) tops the guest view like a club sash.

Light cones (`--color-cone-*`, set on `:root` because they are used from inline styles): Bier amber, Wein rosé, Softdrinks cool blue, Kurze magenta, Gläser neutral.

## Type

- Display: **Big Shoulders Display** (self-hosted, Fontsource). Tall condensed figures, echoing the Kölsch-Stange. Table number (7–11 rem), section headings (uppercase), prices, quantities.
- Text: **Atkinson Hyperlegible Next**. Built for legibility; base 17 px. Tabular figures everywhere.

## Shape

Surfaces 16 px, buttons 14 px, small controls (chips, steppers, badges) full pill. Selected cards get a 2 px `accent-2` outline (outline, not shadow, so the photo cannot cover it).

## Product photos

Studio shots on pure black (`public/img/drinks`), rendered with `mix-blend-mode: screen` so the black melts into the card and the drink floats over its category cone. New photos: `process-drink-images.mjs`, then `clean-drink-blacks.mjs` once.

## Components (`src/ui`)

Button (primary / secondary / quiet / danger, min 48–56 px), Stepper (− n +, 44–48 px targets, neutral or accent), Sheet (bottom sheet, drag/Esc/backdrop, focus trap, stackable), NumberGrid (0–8 one-tap), CountdownRing, Toast (with 5 s "Rückgängig"), Badge, ProductImage, Notice (full-screen state on bokeh), Skeleton.

Shared menu (`src/features/menu`): category chips with scroll spy, photo cards (tap = +1, plus morphs into stepper), "Für den Tisch" tiles opening a sheet, glasses question, cart bar and cart sheet. Used by guests and waiters.

## Staff screens (`src/features/waiter`, `src/features/bar`, shared parts in `src/features/staff`)

- **Ticket stub** carries table number and waiting time; its fill is the urgency light: `surface-3` < 3 min, `warn` 3–6 min, `late` breathing (`late-pulse`) > 6 min. Same rule for the bar tile header.
- **Waiter**: setup in three steps on bokeh (name, table grid, alarm), list "Meine Aufträge" oldest first, "Ohne Kellner" for uncovered tables, colleagues' orders folded away. Swipe right or button for the next step; ⋮ sheet for hand-over, reorder, cancel. Bottom dock: my tables + "Bon".
- **Alarm**: full screen in `accent-2` with the table number at 8–13 rem and an expanding ring; Web Audio pattern + vibration until taken or put aside.
- **Bar**: tile board (oldest top left) with "Fertig", side column with pick list ("Sammelliste") and "Abholbereit"; below `lg` the three become tabs. Bar tabs when an event has several bars.

## Motion

Springs from `motion/react` for state changes only: stepper pop, sheet, cart bar, toast, order progress. `MotionConfig reducedMotion="user"` plus a CSS reduced-motion override.

## Admin console (`src/features/admin`)

Same tokens and components, laid out for a laptop or tablet: sticky header (event picker, Bestellsperre, Notfall-Stopp, logout), scrolling tab strip, content up to 72 rem. PIN pad on bokeh for login. Cards (`surface-1`) with display-type headings; numbers in `num`; destructive actions always through a confirmation sheet that says what stops working. Lists are rows with inline controls (price field, pill toggles for Beliebt / Ausverkauft / An); drag handle or arrow keys reorder. QR sheets print from their own plain white window so the dark theme never reaches paper.
