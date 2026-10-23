import { useEffect } from 'react';

/**
 * The guest and waiter pages paint their confetti photo (#bokeh-shell) straight from the HTML, before
 * any script runs. Screens that do not want it (full-screen notices, the waiter's list) hide it while shown.
 */
export function useHideShellPhoto() {
  useEffect(() => {
    const shell = document.getElementById('bokeh-shell');
    if (!shell) return;
    shell.hidden = true;
    return () => {
      shell.hidden = false;
    };
  }, []);
}
