import { httpsCallable } from 'firebase/functions';
import type { CartLine } from '@shared/pricing';
import type { OrderAction } from '@shared/order-lifecycle';
import { fns } from './firebase';

/** Server error reasons mapped to messages people understand. */
const messages: Record<string, string> = {
  codeInvalid: 'Dieser Tisch-Code ist nicht gültig.',
  eventEnded: 'Diese Veranstaltung ist beendet.',
  eventNotStarted: 'Die Veranstaltung hat noch nicht begonnen.',
  shutdown: 'Das Bestellsystem ist gerade außer Betrieb.',
  ordersPaused: 'Bestellungen sind gerade pausiert.',
  cooldown: 'Bitte einen Moment warten, dann erneut versuchen.',
  soldOut: 'Ein Artikel ist leider ausverkauft.',
  unknown: 'Ein Artikel ist nicht mehr verfügbar.',
  badQty: 'Bitte die Menge prüfen.',
  empty: 'Der Warenkorb ist leer.',
  linkInvalid: 'Dieser Zugangslink ist nicht (mehr) gültig.',
  linkRotated: 'Der Zugangslink wurde erneuert. Bitte den neuen Link öffnen.',
  sessionExpired: 'Sitzung abgelaufen. Bitte den Link erneut öffnen.',
  otherEvent: 'Dieser Zugang gehört zu einer anderen Veranstaltung.',
  nameMissing: 'Bitte zuerst deinen Namen eingeben.',
  tableMissing: 'Bitte einen Tisch wählen.',
  claimedByOther: 'Das hat schon jemand anderes übernommen.',
  notAllowed: 'Das geht in diesem Zustand nicht.',
  finished: 'Diese Bestellung ist bereits abgeschlossen.',
  orderMissing: 'Diese Bestellung gibt es nicht mehr.',
  wrongPin: 'Falsche PIN.',
  tooManyAttempts: 'Zu viele Versuche. Bitte 15 Minuten warten.',
  pinNotSet: 'Es ist noch keine Admin-PIN eingerichtet.',
  adminRequired: 'Dafür ist die Admin-PIN nötig.',
};

export class ApiError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(messages[reason] ?? 'Verbindung fehlgeschlagen. Bitte erneut versuchen.');
    this.reason = reason;
  }
}

async function call<T>(name: string, data: unknown): Promise<T> {
  try {
    return (await httpsCallable(fns, name)(data)).data as T;
  } catch (e) {
    throw new ApiError((e as { details?: { reason?: string } }).details?.reason ?? 'network');
  }
}

/** Idempotency key: retrying with the same id never creates a second order. */
export const newRequestId = () => crypto.randomUUID();

export const api = {
  staffSession: (token: string) => call<{ customToken: string; eventId: string }>('staffSession', { token }),
  adminSession: (pin: string) => call<{ customToken: string }>('adminSession', { pin }),
  changeAdminPin: (pin: string, newPin: string) => call('changeAdminPin', { pin, newPin }),

  guestOrder: (code: string, lines: CartLine[], requestId: string) =>
    call<{ orderId: string }>('createGuestOrder', { code, type: 'order', lines, requestId }),
  callWaiter: (code: string, requestId: string) =>
    call<{ orderId: string }>('createGuestOrder', { code, type: 'call', requestId }),
  waiterOrder: (input: {
    eventId: string;
    type: 'order' | 'tab';
    tableId?: string;
    note?: string;
    sendToBar?: boolean;
    lines: CartLine[];
    requestId: string;
  }) => call<{ orderId: string }>('createWaiterOrder', input),
  orderAction: (eventId: string, orderId: string, action: OrderAction) =>
    call<{ status: string }>('orderAction', { eventId, orderId, action }),

  createEvent: (input: { name: string; startsAt: number; endsAt: number; mode: 'tables' | 'noTables'; copyFrom?: string }) =>
    call<{ eventId: string }>('createEvent', input),
  setTables: (eventId: string, tables: { id?: string; label: string }[]) => call('setTables', { eventId, tables }),
  regenerateGuestCodes: (eventId: string) => call('regenerateGuestCodes', { eventId }),
  rotateStaffLink: (eventId: string) => call('rotateStaffLink', { eventId }),
};
