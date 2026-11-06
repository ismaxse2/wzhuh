const REDIRECT_PARAM = "__ghp";

/** Decode only our root-level Pages transport URL, preserving the original route. */
export function restoredPagesUrl(href: string, base: string): string | null {
  const current = new URL(href);
  if (current.pathname !== base || !current.searchParams.has(REDIRECT_PARAM))
    return null;
  const fallback = new URL(current);
  fallback.searchParams.delete(REDIRECT_PARAM);
  const root = fallback.pathname + fallback.search + fallback.hash;
  const values = current.searchParams.getAll(REDIRECT_PARAM);
  const saved = values[0];
  if (
    values.length !== 1 ||
    !saved ||
    !saved.startsWith(base) ||
    saved.includes("\\") ||
    [...saved].some((character) => character.charCodeAt(0) < 32)
  )
    return root;
  try {
    const target = new URL(saved, current.origin);
    if (
      target.origin !== current.origin ||
      !target.pathname.startsWith(base) ||
      target.searchParams.has(REDIRECT_PARAM)
    )
      return root;
    return target.pathname + target.search + target.hash;
  } catch {
    return root;
  }
}

type BrowserNavigation = {
  location: Pick<Location, "href">;
  history: Pick<History, "replaceState" | "state">;
};
export function restorePagesRoute(
  enabled: boolean,
  base: string,
  browser: BrowserNavigation = window,
): boolean {
  if (!enabled) return false;
  const target = restoredPagesUrl(browser.location.href, base);
  if (target === null) return false;
  browser.history.replaceState(browser.history.state, "", target);
  return true;
}
