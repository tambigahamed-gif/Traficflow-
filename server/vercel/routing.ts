export function restoreExpressApiUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;

  let incoming: URL;
  try {
    incoming = new URL(rawUrl, "http://vercel.local");
  } catch {
    return null;
  }

  const path = incoming.searchParams.get("path");
  if (!path) return null;

  const remainingQuery = new URLSearchParams(incoming.searchParams);
  remainingQuery.delete("path");
  const query = remainingQuery.toString();
  const normalizedPath = path.replace(/^\/+/, "");

  return `/api/${normalizedPath}${query ? `?${query}` : ""}`;
}
