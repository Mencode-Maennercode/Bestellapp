import { cx } from './cx';

interface Props {
  /** 1 = full, 0 = empty. */
  progress: number;
  size?: number;
  stroke?: number;
  className?: string;
}

/** Thin ring that drains while a cooldown runs. */
export function CountdownRing({ progress, size = 28, stroke = 3, className }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cx('-rotate-90', className)} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}
