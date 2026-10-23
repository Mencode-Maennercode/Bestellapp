import type { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'neutral' | 'accent' | 'warn' | 'late';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-2 text-accent-2-ink',
  warn: 'bg-warn text-[#1d1204]',
  late: 'bg-late text-[#1a0605]',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-[0.8125rem] font-bold leading-none', tones[tone], className)}>
      {children}
    </span>
  );
}
