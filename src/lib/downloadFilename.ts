/**
 * Extrae el nombre de archivo sugerido por el backend en `Content-Disposition`. Prefiere
 * `filename*` (UTF-8, con acentos: "Nota de Crédito A …") sobre el `filename` ASCII.
 */
export function filenameFromContentDisposition(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const match =
    header.match(/filename\*=(?:UTF-8'')?"?([^";]+)"?/i) ??
    header.match(/filename="?([^";]+)"?/i);
  if (!match?.[1]) return fallback;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Descarga el cuerpo de una respuesta OK con el nombre que manda el backend. */
export async function descargarRespuesta(res: Response, fallbackFilename: string): Promise<void> {
  const filename = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
    fallbackFilename,
  );
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
