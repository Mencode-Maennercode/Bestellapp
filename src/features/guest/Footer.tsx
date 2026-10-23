import { DeviceMobile } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Sheet } from '@/ui';
import type { GuestStrings } from './strings';

const base = import.meta.env.BASE_URL;

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** "Als App speichern": native prompt on Android/Chrome, a short how-to on iOS, hidden once installed. */
function useInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const standalone =
    typeof window !== 'undefined' &&
    (matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    addEventListener('beforeinstallprompt', onPrompt);
    return () => removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  return { available: !standalone && (ios || !!prompt), ios, prompt };
}

export function Footer({ t }: { t: GuestStrings }) {
  const install = useInstall();
  const [howTo, setHowTo] = useState(false);

  return (
    <footer className="mt-10 border-t border-line pt-8 pb-[calc(var(--safe-bottom)+7rem)]">
      {install.available && (
        <button
          type="button"
          onClick={() => (install.prompt ? install.prompt.prompt() : setHowTo(true))}
          className="mb-8 flex min-h-12 items-center gap-2.5 rounded-[var(--radius-btn)] bg-surface-1 px-4 font-bold text-ink-2 shadow-[var(--edge)] hover:text-ink"
        >
          <DeviceMobile size={22} />
          {t.installApp}
        </button>
      )}
      <a href="https://www.praesenzwert.de" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center gap-3 no-underline">
        <img src={`${base}img/praesenzwert.png`} alt="" width={36} height={32} className="h-8 w-auto opacity-85" />
        <span className="text-[0.9375rem] text-ink-3">
          {t.presented} <span className="font-bold text-ink-2">PräsenzWert</span>
        </span>
      </a>
      <nav className="mt-4 flex gap-5 text-[0.9375rem] text-ink-3">
        <a href={`${base}rechtliches/#impressum`} className="inline-flex min-h-11 items-center hover:text-ink">{t.impressum}</a>
        <a href={`${base}rechtliches/#datenschutz`} className="inline-flex min-h-11 items-center hover:text-ink">{t.privacy}</a>
      </nav>

      <Sheet open={howTo} onClose={() => setHowTo(false)} title={t.installApp}>
        <p className="pb-4 text-lg text-ink-2">{t.iosInstall}</p>
      </Sheet>
    </footer>
  );
}
