import { useEffect, useState } from 'react';
import type { EventPublic } from '@shared/types';
import { ensureStaffSession, hashParam } from '@/data/session';
import { useLive } from '@/data/live';
import { Placeholder } from './mount';

/** Shared by waiter and bar scaffolds: silent login from the link, then show the event. */
export function StaffScaffold({ role }: { role: 'Kellner' | 'Theke' }) {
  const [state, setState] = useState<{ eventId?: string; error?: string }>({});
  useEffect(() => {
    ensureStaffSession(hashParam())
      .then(s => setState({ eventId: s.eventId }))
      .catch((e: Error) => setState({ error: e.message }));
  }, []);
  const pub = useLive<EventPublic>(state.eventId ? `events/${state.eventId}/public` : null);

  if (state.error) return <Placeholder title="Kein Zugang">{state.error}</Placeholder>;
  if (pub.status !== 'ready') return <Placeholder title="Anmelden …" />;
  return <Placeholder title={role}>{pub.value?.name}</Placeholder>;
}
