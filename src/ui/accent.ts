// Club colours come from the event settings. Text on top of them picks whichever of
// near-black / near-white has the higher WCAG contrast ratio.

const DARK = '#0a0d0b';
const LIGHT = '#f6f8f6';

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Readable text colour on the given background. */
export function inkOn(bg: string): string {
  return contrastRatio(bg, DARK) >= contrastRatio(bg, LIGHT) ? DARK : LIGHT;
}

const HEX = /^#[0-9a-f]{6}$/i;

export function applyAccent(accent?: { primary: string; secondary: string } | null) {
  const root = document.documentElement.style;
  const primary = accent && HEX.test(accent.primary) ? accent.primary : '#009640';
  const secondary = accent && HEX.test(accent.secondary) ? accent.secondary : '#ffcc00';
  root.setProperty('--accent', primary);
  root.setProperty('--accent-ink', inkOn(primary));
  root.setProperty('--accent-2', secondary);
  root.setProperty('--accent-2-ink', inkOn(secondary));
}
