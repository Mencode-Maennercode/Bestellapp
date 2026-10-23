import type { ReactNode } from 'react';

const bokeh = `${import.meta.env.BASE_URL}img/bokeh-dunkel.webp`;

/** Full-screen state: invalid code, event ended, not started, connection problems. */
export function Notice({ icon, title, children, action }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <main className="relative isolate grid min-h-dvh items-end overflow-hidden pt-[var(--safe-top)] pb-[max(2.5rem,var(--safe-bottom))] gutter">
      <img src={bokeh} alt="" aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full object-cover opacity-55" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-bg via-bg/85 to-bg/20" />
      <div className="mx-auto w-full max-w-md pb-[8dvh]">
        {icon && <div className="mb-5 text-accent-2">{icon}</div>}
        <h1 className="font-display text-[clamp(2.75rem,12vw,4.25rem)] leading-[0.94] font-extrabold uppercase text-balance">{title}</h1>
        {children && <div className="mt-4 max-w-[36ch] text-lg text-ink-2 text-pretty">{children}</div>}
        {action && <div className="mt-8">{action}</div>}
      </div>
    </main>
  );
}
