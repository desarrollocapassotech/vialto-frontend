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

/**
 * Fallas 5xx de infraestructura de AFIP/ARCA (servidores/BD de ellos).
 * No son datos del comprobante: el operador debe reintentar más tarde.
 */
export const MSG_AFIP_INFRA =
  "AFIP tiene un problema interno en este momento. El comprobante no se autorizó. Reintentá emitir más tarde.";

/** Detecta errores de infraestructura AFIP (501 CabInsert, 500/502, etc.). */
export function isAfipInfrastructureError(
  raw: string | null | undefined,
): boolean {
  if (!raw?.trim()) return false;
  const t = raw.trim();
  if (t === MSG_AFIP_INFRA) return true;
  if (/Error interno de base de datos/i.test(t)) return true;
  if (/CabInsert/i.test(t)) return true;
  if (
    /\b50[012]\b/.test(t) &&
    /(FECAE|base de datos|Error interno|Autorizador CAE|Transacci[oó]n Activa)/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
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
  const errItems = asArray(errors as AfipErrLike | AfipErrLike[]);
  // Códigos 500/501/502 en el array Errors de AFIP = infraestructura.
  if (
    errItems.some((e) => {
      const code = Number(e.Code);
      return code === 500 || code === 501 || code === 502;
    })
  ) {
    return MSG_AFIP_INFRA;
  }
  const fromErrors = collectMsgs(errItems);
  if (fromErrors.length) {
    const joined = fromErrors.join(" ");
    if (isAfipInfrastructureError(joined)) return MSG_AFIP_INFRA;
    return joined;
  }

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

  if (isAfipInfrastructureError(trimmed)) return MSG_AFIP_INFRA;

  if (trimmed.startsWith("Rechazado por AFIP:")) {
    const rest = trimmed.slice("Rechazado por AFIP:".length).trim();
    if (isAfipInfrastructureError(rest)) return MSG_AFIP_INFRA;
    return trimmed;
  }

  const respuestaMatch = trimmed.match(/Respuesta:\s*(\{[\s\S]*\})\s*$/);
  if (respuestaMatch) {
    const parsed = tryParseJson(respuestaMatch[1]);
    const detail = parsed ? extractAfipRejectionMessage(parsed) : null;
    if (detail) {
      if (detail === MSG_AFIP_INFRA || isAfipInfrastructureError(detail)) {
        return MSG_AFIP_INFRA;
      }
      return `Rechazado por AFIP: ${detail}`;
    }
  }

  if (trimmed.startsWith("{")) {
    const parsed = tryParseJson(trimmed);
    const detail = parsed ? extractAfipRejectionMessage(parsed) : null;
    if (detail) {
      if (detail === MSG_AFIP_INFRA || isAfipInfrastructureError(detail)) {
        return MSG_AFIP_INFRA;
      }
      return `Rechazado por AFIP: ${detail}`;
    }
  }

  if (
    trimmed.includes("FECAESolicitarResult") ||
    trimmed.includes('"Observaciones"') ||
    trimmed.includes("AFIP SDK no devolvió CAE")
  ) {
    const detail = extractFromEmbeddedJson(trimmed);
    if (detail) {
      if (detail === MSG_AFIP_INFRA || isAfipInfrastructureError(detail)) {
        return MSG_AFIP_INFRA;
      }
      return `Rechazado por AFIP: ${detail}`;
    }
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
