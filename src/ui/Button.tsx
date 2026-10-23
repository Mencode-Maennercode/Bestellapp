import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110',
  secondary: 'surface-3 text-ink hover:bg-[#28322b]',
  quiet: 'bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'bg-late text-[#1a0605] hover:brightness-110',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  icon?: ReactNode;
  busy?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon, busy, className, children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2.5 rounded-[var(--radius-btn)] font-bold whitespace-nowrap',
        'transition-[transform,filter,background-color,color,opacity] duration-200 ease-[var(--ease-out-expo)]',
        'active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100',
        size === 'lg' ? 'min-h-14 px-6 text-lg' : 'min-h-12 px-5 text-base',
        variants[variant],
        className,
      )}
    >
      {icon && <span className="-ml-0.5 grid shrink-0 place-items-center" aria-hidden>{icon}</span>}
      {children}
    </button>
  );
}
