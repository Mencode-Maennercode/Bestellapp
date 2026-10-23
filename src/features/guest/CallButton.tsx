import { BellRinging } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Button, CountdownRing, cx } from '@/ui';

interface Props {
  label: string;
  confirmLabel: string;
  /** Epoch ms until which the table cannot call again (server cooldown), or 0. */
  cooldownUntil: number;
  cooldownMs: number;
  now: number;
  busy: boolean;
  /** System shut down: the server refuses calls, so do not offer one. */
  disabled?: boolean;
  onCall: () => void;
}

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Two taps to call (no accidental calls), then a ring drains until the next call is possible. */
export function CallButton({ label, confirmLabel, cooldownUntil, cooldownMs, now, busy, disabled, onCall }: Props) {
  const [confirming, setConfirming] = useState(false);
  const left = Math.max(0, cooldownUntil - now);

  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (left > 0) {
    return (
      <div
        role="status"
        className="flex min-h-14 items-center justify-center gap-3 rounded-[var(--radius-btn)] bg-surface-2 px-4 font-bold text-ink-2 shadow-[var(--edge)]"
      >
        <CountdownRing progress={left / cooldownMs} size={30} className="text-accent-2" />
        <span className="num text-[1.625rem] leading-none text-ink" aria-label={`Erneut rufen in ${fmt(left)} Minuten`}>{fmt(left)}</span>
      </div>
    );
  }

  return (
    <Button
      size="lg"
      variant="secondary"
      busy={busy}
      disabled={disabled}
      icon={<BellRinging size={22} weight="fill" />}
      className={cx('w-full', confirming && '!bg-accent-2 !text-accent-2-ink')}
      onClick={() => {
        if (!confirming) return setConfirming(true);
        setConfirming(false);
        onCall();
      }}
    >
      {confirming ? confirmLabel : label}
    </Button>
  );
}
