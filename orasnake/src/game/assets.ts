const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

export function publicAssetPath(path: string, baseUrl: string = import.meta.env.BASE_URL): string {
  const trimmedPath = path.trim();

  if (ABSOLUTE_URL_PATTERN.test(trimmedPath) || trimmedPath.startsWith("data:")) {
    return trimmedPath;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const relativePath = trimmedPath.replace(/^\/+/, "");

  return `${normalizedBase}${relativePath}`;
}
