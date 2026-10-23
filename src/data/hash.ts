/** Code or token after "#", e.g. /tisch/#K7M2P9QX4R. Never sent to the web server. */
export function hashParam(): string {
  return decodeURIComponent(location.hash.slice(1)).trim().toUpperCase();
}
