import { MotionConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@/ui';
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

