/**
 * Comprobante cargado a mano en una empresa con ARCA (factura hecha por fuera del sistema,
 * factura del transportista en una liquidación manual): tipo AFIP, punto de venta y número
 * por separado, obligatorios, para el Libro IVA. Espejo de
 * `vialto-backend/src/shared/util/comprobante-manual.util.ts`.
 */

/** Orden lógico (A, B, C, M, E, FCE), no alfabético. */
export const TIPOS_COMPROBANTE_MANUAL: ReadonlyArray<{
  codigo: number;
  letra: string;
  label: string;
}> = [
  { codigo: 1, letra: "A", label: "Factura A" },
  { codigo: 6, letra: "B", label: "Factura B" },
  { codigo: 11, letra: "C", label: "Factura C" },
  { codigo: 51, letra: "M", label: "Factura M" },
  { codigo: 19, letra: "E", label: "Factura E" },
  { codigo: 201, letra: "FCE A", label: "Factura de Crédito Electrónica A" },
  { codigo: 206, letra: "FCE B", label: "Factura de Crédito Electrónica B" },
  { codigo: 211, letra: "FCE C", label: "Factura de Crédito Electrónica C" },
];

const PTO_VENTA_MAX = 99999;
const CBTE_NRO_MAX = 99999999;

/** Valores del formulario (texto, como los inputs). `fecha` = YYYY-MM-DD, solo liquidaciones. */
export type ComprobanteManualDraft = {
  cbteTipo: string;
  ptoVenta: string;
  cbteNro: string;
  fecha: string;
};

export type ComprobanteManualErrores = Partial<
  Record<keyof ComprobanteManualDraft, string>
>;

export function emptyComprobanteManualDraft(): ComprobanteManualDraft {
  return { cbteTipo: "", ptoVenta: "", cbteNro: "", fecha: "" };
}

export function formatNumeroComprobanteManual(
  cbteTipo: number,
  ptoVenta: number,
  cbteNro: number,
): string {
  const letra =
    TIPOS_COMPROBANTE_MANUAL.find((t) => t.codigo === cbteTipo)?.letra ??
    String(cbteTipo);
  return `${letra} ${String(ptoVenta).padStart(4, "0")}-${String(cbteNro).padStart(8, "0")}`;
}

/** "A 0001-00000123", "Factura C 00001-94", "FCE B 2-15"… → partes; null si no se reconoce. */
export function parsearNumeroComprobante(
  texto: string | null | undefined,
): { cbteTipo: number; ptoVenta: number; cbteNro: number } | null {
  const limpio = (texto ?? "").trim().replace(/\s+/g, " ");
  const m = limpio.match(
    /^(?:factura(?:\s+de\s+cr[eé]dito\s+electr[oó]nica)?\s+|fac\.?\s+)?(fce\s*)?([abcme])\s*[-\s]?\s*(\d{1,5})\s*-\s*(\d{1,8})$/i,
  );
  if (!m) return null;
  const letra = `${m[1] ? "FCE " : ""}${m[2].toUpperCase()}`;
  const tipo = TIPOS_COMPROBANTE_MANUAL.find((t) => t.letra === letra);
  const ptoVenta = Number(m[3]);
  const cbteNro = Number(m[4]);
  if (!tipo || ptoVenta < 1 || cbteNro < 1) return null;
  return { cbteTipo: tipo.codigo, ptoVenta, cbteNro };
}

/**
 * Draft inicial desde lo guardado: los campos por separado si existen; si no (registros
 * anteriores), se interpreta el número escrito. Lo que no se reconoce queda vacío.
 */
export function comprobanteManualDraftDesde(datos: {
  cbteTipo?: number | null;
  ptoVenta?: number | null;
  cbteNro?: number | null;
  numero?: string | null;
  fecha?: string | null;
}): ComprobanteManualDraft {
  const partes =
    datos.cbteTipo != null && datos.ptoVenta != null && datos.cbteNro != null
      ? { cbteTipo: datos.cbteTipo, ptoVenta: datos.ptoVenta, cbteNro: datos.cbteNro }
      : parsearNumeroComprobante(datos.numero);
  return {
    cbteTipo: partes ? String(partes.cbteTipo) : "",
    ptoVenta: partes ? String(partes.ptoVenta) : "",
    cbteNro: partes ? String(partes.cbteNro) : "",
    fecha: datos.fecha ? datos.fecha.slice(0, 10) : "",
  };
}

function enteroEnRango(texto: string, max: number): boolean {
  if (!/^\d+$/.test(texto)) return false;
  const n = Number(texto);
  return n >= 1 && n <= max;
}

/** Errores por campo (vacío = válido). `conFecha` en liquidaciones (fecha de la factura). */
export function validarComprobanteManual(
  draft: ComprobanteManualDraft,
  conFecha: boolean,
): ComprobanteManualErrores {
  const errs: ComprobanteManualErrores = {};
  if (!draft.cbteTipo) errs.cbteTipo = "Elegí el tipo de comprobante.";
  if (!draft.ptoVenta.trim()) errs.ptoVenta = "Ingresá el punto de venta.";
  else if (!enteroEnRango(draft.ptoVenta.trim(), PTO_VENTA_MAX)) {
    errs.ptoVenta = `El punto de venta va de 1 a ${PTO_VENTA_MAX}.`;
  }
  if (!draft.cbteNro.trim()) errs.cbteNro = "Ingresá el número de comprobante.";
  else if (!enteroEnRango(draft.cbteNro.trim(), CBTE_NRO_MAX)) {
    errs.cbteNro = `El número de comprobante va de 1 a ${CBTE_NRO_MAX}.`;
  }
  if (conFecha && !draft.fecha) errs.fecha = "Ingresá la fecha de la factura.";
  return errs;
}

/** Partes numéricas del draft ya validado. */
export function comprobanteManualPartes(draft: ComprobanteManualDraft) {
  return {
    cbteTipo: Number(draft.cbteTipo),
    ptoVenta: Number(draft.ptoVenta.trim()),
    cbteNro: Number(draft.cbteNro.trim()),
  };
}

/** Número para mostrar mientras se carga ("A 0001-00000123"), o "" si está incompleto. */
export function numeroDesdeComprobanteManual(draft: ComprobanteManualDraft): string {
  if (Object.keys(validarComprobanteManual(draft, false)).length > 0) return "";
  const p = comprobanteManualPartes(draft);
  return formatNumeroComprobanteManual(p.cbteTipo, p.ptoVenta, p.cbteNro);
}

/** Body de una factura manual (`manualCbteTipo`/`manualPtoVenta`/`manualCbteNro`). */
export function payloadComprobanteFactura(draft: ComprobanteManualDraft) {
  const p = comprobanteManualPartes(draft);
  return { manualCbteTipo: p.cbteTipo, manualPtoVenta: p.ptoVenta, manualCbteNro: p.cbteNro };
}

/** Body de una liquidación manual (`proveedorCbte*`, fecha incluida). */
export function payloadComprobanteLiquidacion(draft: ComprobanteManualDraft) {
  const p = comprobanteManualPartes(draft);
  return {
    proveedorCbteTipo: p.cbteTipo,
    proveedorPtoVenta: p.ptoVenta,
    proveedorCbteNro: p.cbteNro,
    proveedorCbteFecha: draft.fecha,
  };
}
