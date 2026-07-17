/** Extrae el nombre de archivo sugerido por el backend en `Content-Disposition`. */
export function filenameFromContentDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
