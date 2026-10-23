/**
 * A site built for one event (`npm run build:event`) only talks to that event: codes and links of
 * any other event are refused even if the database would still know them. Empty = not locked.
 */
export const lockedEventId: string | null = import.meta.env.VITE_EVENT_ID || null;

export const isOtherEvent = (eventId: string) => !!lockedEventId && eventId !== lockedEventId;
