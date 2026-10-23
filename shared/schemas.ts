import { z } from 'zod';
import { MAX_LINES, MAX_QTY } from './pricing';
import { CODE_PATTERN, TOKEN_PATTERN } from './codes';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const name = z.string().trim().min(1).max(40);
/** Folder name of the published event site, e.g. "Hochzeit-Meier" (also the URL path). */
export const slug = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/);
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const cartLines = z
  .array(z.object({ productId: id, qty: z.number().int().min(1).max(MAX_QTY) }))
  .min(1)
  .max(MAX_LINES);

/** Client-generated key so a retried request never creates a second order. */
export const requestId = z.string().regex(/^[A-Za-z0-9-]{16,40}$/);

export const guestOrderInput = z.object({
  code: z.string().regex(CODE_PATTERN),
  type: z.enum(['order', 'call']),
  lines: cartLines.optional(),
  requestId,
});

export const waiterOrderInput = z.object({
  eventId: id,
  type: z.enum(['order', 'tab']),
  tableId: id.optional(),
  note: z.string().trim().max(40).optional(),
  sendToBar: z.boolean().default(true),
  lines: cartLines,
  requestId,
  name: z.string().trim().min(1).max(40).optional(),
});

export const orderActionInput = z.object({
  eventId: id,
  orderId: id,
  action: z.enum(['claim', 'unclaim', 'ready', 'unready', 'serve', 'unserve', 'cancel']),
});

export const staffSessionInput = z.object({ token: z.string().regex(TOKEN_PATTERN) });
export const adminSessionInput = z.object({ pin: z.string().regex(/^\d{4,8}$/) });
export const changePinInput = z.object({ pin: z.string().regex(/^\d{4,8}$/), newPin: z.string().regex(/^\d{4,8}$/) });

const ts = z.number().int().min(1_700_000_000_000).max(4_000_000_000_000);

export const createEventInput = z.object({
  name,
  startsAt: ts,
  endsAt: ts,
  mode: z.enum(['tables', 'noTables']),
  slug: slug.optional(),
  /** Copy catalog, tables, bars and settings from this event; otherwise use the default catalog. */
  copyFrom: id.optional(),
}).refine(v => v.endsAt > v.startsAt, { message: 'endsAt must be after startsAt' });

export const setTablesInput = z.object({
  eventId: id,
  tables: z.array(z.object({ id: id.optional(), label: z.string().trim().min(1).max(12) })).max(300),
});

export const eventIdInput = z.object({ eventId: id });
export const setWaiterNameInput = z.object({ eventId: id, name });


export const updateEventInput = z.object({
  eventId: id,
  name: name.optional(),
  startsAt: ts.optional(),
  endsAt: ts.optional(),
  language: z.enum(['koelsch', 'hochdeutsch']).optional(),
  archiveMinutes: z.number().int().min(1).max(240).optional(),
  accent: z.object({ primary: color, secondary: color }).optional(),
  slug: slug.nullable().optional(),
  /** Closing goes through `closeEvent`; this only toggles draft ↔ live. */
  status: z.enum(['draft', 'live']).optional(),
});

export const rotateLinkInput = z.object({ eventId: id, role: z.enum(['waiter', 'bar', 'both']).default('both') });
