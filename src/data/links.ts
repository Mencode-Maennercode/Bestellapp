// Public addresses of an event. An event published under its own folder ("slug") lives at
// <host>/<slug>/…; without a slug the site this page is served from is used.

export const siteRoot = (slug?: string | null) => (slug ? `${location.origin}/${slug}/` : `${location.origin}${import.meta.env.BASE_URL}`);

export const guestUrl = (slug: string | null | undefined, guestCode: string) => `${siteRoot(slug)}tisch/#${guestCode}`;
export const waiterUrl = (slug: string | null | undefined, token: string) => `${siteRoot(slug)}kellner/#${token}`;
export const barUrl = (slug: string | null | undefined, token: string) => `${siteRoot(slug)}theke/#${token}`;
