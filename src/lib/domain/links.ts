/**
 * FR-2.4: external links and embedded media. Only http and https links are
 * accepted, and only players known to allow embedding are shown in a frame;
 * any other page opens in a new tab.
 */

/** A well-formed http or https URL. */
export function isWebUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The address to load in an `<iframe>` for a link that points at embeddable
 * media, or `undefined` when the link should simply be opened.
 */
export function embedUrlFor(value: string): string | undefined {
  if (!isWebUrl(value)) return undefined;
  const url = new URL(value.trim());
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : undefined;
  }
  if (host === "vimeo.com") {
    const id = url.pathname.match(/^\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : undefined;
  }
  return undefined;
}
