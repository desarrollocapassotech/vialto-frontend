type AfipErrLike = { Code?: unknown; Msg?: unknown; Message?: unknown };

function collectMsgs(items: AfipErrLike[] | undefined): string[] {
  if (!items?.length) return [];
  return items
    .map((e) => {
      const msg = e.Msg ?? e.Message;
      return typeof msg === "string" ? msg.trim() : "";
    })
    .filter(Boolean);
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Extrae mensajes legibles de una respuesta FECAESolicitar (sin JSON crudo). */
export function extractAfipRejectionMessage(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const root = response as Record<string, unknown>;
  const solResult = (root.FECAESolicitarResult ?? root) as Record<
    string,
    unknown
  >;

  const errors = (solResult.Errors as Record<string, unknown> | undefined)
    ?.Err;
  const fromErrors = collectMsgs(asArray(errors as AfipErrLike | AfipErrLike[]));
  if (fromErrors.length) return fromErrors.join(" ");

  const detResp = solResult.FeDetResp as Record<string, unknown> | undefined;
  const detArr = detResp?.FECAEDetResponse;
  const det = asArray(
    detArr as Record<string, unknown> | Record<string, unknown>[],
  )[0];
  if (!det) return null;

  const obs = (det.Observaciones as Record<string, unknown> | undefined)?.Obs;
  const fromObs = collectMsgs(asArray(obs as AfipErrLike | AfipErrLike[]));
  if (fromObs.length) return fromObs.join(" ");

  return null;
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractFromEmbeddedJson(text: string): string | null {
  const jsonStart = text.indexOf("{");
  if (jsonStart < 0) return null;
  const parsed = tryParseJson(text.slice(jsonStart));
  return parsed ? extractAfipRejectionMessage(parsed) : null;
}

const GENERIC_AFIP_REJECTION =
  "AFIP no autorizó el comprobante. Revisá los importes y la configuración de ARCA.";

/**
 * Convierte `arcaError` persistido (incl. JSON crudo legacy) en texto para operadores.
 */
export function formatStoredArcaError(
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();

  if (trimmed.startsWith("Rechazado por AFIP:")) return trimmed;

  const respuestaMatch = trimmed.match(/Respuesta:\s*(\{[\s\S]*\})\s*$/);
  if (respuestaMatch) {
    const parsed = tryParseJson(respuestaMatch[1]);
    const detail = parsed ? extractAfipRejectionMessage(parsed) : null;
    if (detail) return `Rechazado por AFIP: ${detail}`;
  }

  if (trimmed.startsWith("{")) {
    const parsed = tryParseJson(trimmed);
    const detail = parsed ? extractAfipRejectionMessage(parsed) : null;
    if (detail) return `Rechazado por AFIP: ${detail}`;
  }

  if (
    trimmed.includes("FECAESolicitarResult") ||
    trimmed.includes('"Observaciones"') ||
    trimmed.includes("AFIP SDK no devolvió CAE")
  ) {
    const detail = extractFromEmbeddedJson(trimmed);
    if (detail) return `Rechazado por AFIP: ${detail}`;
    return GENERIC_AFIP_REJECTION;
  }

  return trimmed;
}

/** Sanitiza mensajes de API ARCA/AFIP antes de mostrarlos en la UI. */
export function sanitizeArcaApiError(
  message: string | undefined | null,
): string | undefined {
  if (!message?.trim()) return undefined;
  return formatStoredArcaError(message) ?? message.trim();
}
