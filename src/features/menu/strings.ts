import type { Language, TableSection } from '@shared/types';

export interface MenuStrings {
  popular: string;
  forTable: string;
  from: string;
  kinds: (n: number) => string;
  add: (name: string) => string;
  qty: (name: string) => string;
  soldOut: string;
  glassesTitle: string;
  noGlasses: string;
  sections: Record<TableSection, string>;
  cartTitle: string;
  total: string;
  payHint: string;
  drinks: (n: number) => string;
  showCart: string;
  glasses: string;
  menuNav: string;
}

const common = {
  popular: 'Beliebt',
  forTable: 'Für den Tisch',
  from: 'ab',
  kinds: (n: number) => (n === 1 ? '1 Sorte' : `${n} Sorten`),
  add: (name: string) => `${name} hinzufügen`,
  qty: (name: string) => `Anzahl ${name}`,
  soldOut: 'Ausverkauft',
  noGlasses: 'Keine',
  sections: {
    'bottle-nonalc': 'Flasche ohne Alkohol',
    'beer-crate': 'Kiste Bier',
    'wine-bottle': 'Wein & Sekt',
    'shots-crate': 'Kiste Kurze',
  } satisfies Record<TableSection, string>,
  total: 'Summe',
  drinks: (n: number) => (n === 1 ? '1 Getränk' : `${n} Getränke`),
  showCart: 'Ansehen',
  glasses: 'Gläser',
  menuNav: 'Getränkekarte',
};

export const menuStrings: Record<Language, MenuStrings> = {
  koelsch: {
    ...common,
    glassesTitle: 'Wie viele Gläser?',
    cartTitle: 'Deine Bestellung',
    payHint: 'Bezahlt wird am Tisch beim Köbes.',
  },
  hochdeutsch: {
    ...common,
    glassesTitle: 'Wie viele Gläser?',
    cartTitle: 'Ihre Bestellung',
    payHint: 'Bezahlt wird am Tisch bei der Bedienung.',
  },
};
