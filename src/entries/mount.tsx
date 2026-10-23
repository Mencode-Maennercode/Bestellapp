import { MotionConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Notice, ToastProvider } from '@/ui';
import '@/styles/app.css';

export function mount(node: ReactNode) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <ToastProvider>{node}</ToastProvider>
      </MotionConfig>
    </StrictMode>,
  );
}

/** Temporary screen for views that arrive in packages 4–5. */
export function Placeholder({ title, children }: { title: string; children?: ReactNode }) {
  return <Notice title={title}>{children}</Notice>;
}
