import { eventGate } from '@shared/event-window';
import type { EventPublic } from '@shared/types';
import { hashParam } from '@/data/session';
import { useLive, useNow } from '@/data/live';
import { mount, Placeholder } from './mount';

function Guest() {
  const code = hashParam();
  const link = useLive<{ eventId: string; tableId: string }>(code ? `guestCodes/${code}` : null);
  const linkValue = link.status === 'ready' ? link.value : null;
  const pub = useLive<EventPublic>(linkValue ? `events/${linkValue.eventId}/public` : null);
  const label = useLive<string>(linkValue ? `events/${linkValue.eventId}/tables/${linkValue.tableId}/label` : null);
  const now = useNow(30_000);

  if (!code || (link.status === 'ready' && !link.value)) return <Placeholder title="Code ungültig">Bitte den QR-Code am Tisch erneut scannen.</Placeholder>;
  if (pub.status !== 'ready' || !pub.value || label.status !== 'ready') return <Placeholder title="Laden …" />;

  const gate = eventGate(pub.value, now);
  return (
    <Placeholder title={`Tisch ${label.value}`}>
      {pub.value.name} · {gate === 'open' ? 'Bestellung möglich' : gate === 'notStarted' ? 'Noch nicht gestartet' : 'Veranstaltung beendet'}
    </Placeholder>
  );
}

mount(<Guest />);
