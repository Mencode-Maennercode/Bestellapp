import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/app.css';

export function mount(node: ReactNode) {
  createRoot(document.getElementById('root')!).render(<StrictMode>{node}</StrictMode>);
}

/** Temporary scaffold screen – replaced by the real UI in packages 3–5. */
export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="text-[var(--muted)]">{children}</div>
    </main>
  );
}
