# Krea-Prompts Getränkebilder

Modell: `krea/krea-2/large` (18 Credits/Bild, 1:1, 1K, `creativity: raw`). Max. 8 parallele Jobs.
Verarbeitung: `node scripts/process-drink-images.mjs <rohordner>` → `public/img/drinks/{name}-512|1024.webp`.

## Gerüst
`Studio product photograph, eye-level front three-quarter view, <MOTIV>, crisp rim light on the edges, centered with generous margin, on a seamless pure black background, photorealistic, premium beverage advertising look. No text, no logo, no label, no brand.`

Reinschwarzer Hintergrund → im UI per `mix-blend-mode: screen` auf dunkler Karte freigestellt (Glas bleibt durchsichtig, Karten-Lichtkegel scheint durch).

## Motive
koelsch (Kölsch-Stange, Krone) · pils (Pils-Tulpe) · radler (Glas, trüb-gelb, Zitrone; auch Radler 0,0 %) · cola (Tumbler, Eis; auch Zero) · sprite (klar, Limette) · fanta (orange, Orangenscheibe) · apfelschorle (bernstein, Apfelscheibe) · wasser (Perlen) · flasche-wasser/-cola/-sprite/-fanta (unbeschriftete Plastik-/Glasflasche) · kiste-bier (farblose Kiste, Braunglas ohne Etikett; Bitburger/Kölsch) · kiste-gemischt · glas-wein-blanc/-weissburgunder/-jubilus (Weißweinglas, Farbton je Sorte) · flasche-wein (ohne Etikett; für alle 3 Flaschen-Weine) · glas-secco (Flöte) · flasche-sekt (Folienhals, ohne Etikett; auch Secco, LuftiKuss) · baerbelchen (Mini-Fläschchen rot) · glitter-pitter (Glitzer) · kiste-kurze (Kartonträger) · glas-normal / glas-wein-leer / glas-sekt-leer.

Zusätzlich: `public/img/bokeh-dunkel.webp` (Konfetti-Bokeh, 9:16), `public/icon-192|512.png`, `fallback-{bier,softdrinks,wein,kurze,glaeser}` (Kopien passender Produktbilder).

Das Katalog-Feld `image` entspricht dem Dateinamen (siehe `shared/catalog-seed.ts`); Flaschen-Weine, Secco und LuftiKuss haben eigene Dateinamen als Kopie, damit der Seed unverändert bleibt.
