/**
 * Starts the app once the static page is on screen: stylesheet plus the header photo (#bokeh-shell,
 * about 20 KB). Waiting for the photo to be decoded and painted first makes the page look ready at
 * once; the app follows a frame later. In a background tab (no painting) it starts right away.
 */
export function afterFirstPaint(start: () => void) {
  if (document.visibilityState === 'hidden') return start();
  const photo = document.getElementById('bokeh-shell') as HTMLImageElement | null;
  const painted = photo ? photo.decode().catch(() => {}) : Promise.resolve();
  void painted.then(() => requestAnimationFrame(() => setTimeout(start, 0)));
}
