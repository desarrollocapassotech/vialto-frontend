import { paisCodigoDesdeTexto } from "@/lib/ciudades/paises";

export type FacturaEmitEmisor = {
  cuitEmisor?: string | null;
  razonSocial?: string | null;
  domicilioEmisor?: string | null;
  ingBrutos?: string | null;
  inicActEmisor?: string | null;
};

export type FacturaEmitCliente = {
  nombre?: string | null;
  direccion?: string | null;
  idFiscal?: string | null;
  condicionIva?: number | null;
  pais?: string | null;
  condicionTributaria?: string | null;
};

function blank(v: string | null | undefined): boolean {
  return v == null || String(v).trim() === "";
}

/** Normaliza condición IVA desde API (número o string numérico). */
export function normalizeCondicionIva(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function collectFacturaEmitMissingFields(args: {
  emisor: FacturaEmitEmisor | null | undefined;
  cliente: FacturaEmitCliente | null | undefined;
}): string[] {
  const missing: string[] = [];
  const e = args.emisor;
  if (!e || blank(e.cuitEmisor)) missing.push("Emisor: CUIT");
  if (!e || blank(e.razonSocial)) missing.push("Emisor: razón social");
  if (!e || blank(e.domicilioEmisor)) missing.push("Emisor: domicilio");
  if (!e || blank(e.ingBrutos)) missing.push("Emisor: Ingresos Brutos");
  if (!e || blank(e.inicActEmisor)) missing.push("Emisor: inicio de actividad");

  const c = args.cliente;
  if (!c || blank(c.nombre)) missing.push("Cliente: nombre");
  if (!c || blank(c.direccion)) missing.push("Cliente: domicilio");
  if (!c || blank(c.idFiscal)) missing.push("Cliente: CUIT");

  const pais = c?.pais ? paisCodigoDesdeTexto(c.pais) : "AR";
  const esArgentina = !pais || pais === "AR";

  if (esArgentina) {
    if (normalizeCondicionIva(c?.condicionIva) == null) {
      missing.push("Cliente: condición de IVA (país Argentina + campo AFIP)");
    }
  } else {
    if (blank(c?.condicionTributaria)) {
      missing.push("Cliente: condición tributaria");
    }
  }

  return missing;
}

export function formatFacturaEmitMissingMessage(missing: string[]): string | null {
  if (missing.length === 0) return null;
  return `No se puede emitir el comprobante. Faltan datos: ${missing.join("; ")}.`;
}
