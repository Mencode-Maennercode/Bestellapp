import { cx } from './cx';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skeleton rounded-[var(--radius-card)]', className)} />;
}
