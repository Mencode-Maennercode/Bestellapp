import { LazyMotion, MotionConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@/ui';
import '@/styles/app.css';

// The animation engine is not needed for the first paint, so it loads right after it.
const motionFeatures = () => import('./motion-features').then(r => r.default);

/**
 * `codeInHash`: the page reads its code/link from `#…` once at start. Opening another QR code or link
 * in the same tab only changes the hash (no page load), so reload to pick up the new one.
 */
export function mount(node: ReactNode, { codeInHash = false } = {}) {
  if (codeInHash) addEventListener('hashchange', () => location.reload());
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LazyMotion features={motionFeatures}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>{node}</ToastProvider>
        </MotionConfig>
      </LazyMotion>
    </StrictMode>,
  );
}
