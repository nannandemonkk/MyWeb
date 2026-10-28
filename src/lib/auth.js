function hasUnsafeCharacters(value) {
  return Array.from(value).some((character) => character === "\\" || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

// Never use an untrusted return URL as a redirect destination.
export function safeReturnPath(value, fallback = "/manage") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || hasUnsafeCharacters(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || hasUnsafeCharacters(decoded)) return fallback;
    const url = new URL(value, "https://internal.invalid");
    const pathname = decodeURIComponent(url.pathname);
    if (url.origin !== "https://internal.invalid" || pathname.startsWith("//") || pathname.replace(/\/+$/, "").toLowerCase() === "/login") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginPath(returnTo = "/manage") {
  return `/login?${new URLSearchParams({ next: safeReturnPath(returnTo) })}`;
}
