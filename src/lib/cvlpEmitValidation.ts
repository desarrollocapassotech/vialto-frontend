import { paisCodigoDesdeTexto } from "@/lib/ciudades/paises";

/** Datos mínimos del emisor (config ARCA) para emitir CVLP con PDF completo. */
export type CvlpEmitEmisor = {
  cuitEmisor?: string | null;
  domicilioEmisor?: string | null;
  ingBrutos?: string | null;
  inicActEmisor?: string | null;
};

export type CvlpEmitTransportista = {
  domicilio?: string | null;
  idFiscal?: string | null;
  condicionIva?: number | null;
  pais?: string | null;
  condicionTributaria?: string | null;
};

export type CvlpEmitCliente = {
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

/** Lista legible de datos faltantes. Vacío = listo para emitir. */
export function collectCvlpEmitMissingFields(args: {
  emisor: CvlpEmitEmisor | null | undefined;
  transportista: CvlpEmitTransportista | null | undefined;
  cliente: CvlpEmitCliente | null | undefined;
}): string[] {
  const missing: string[] = [];
  const e = args.emisor;
  if (!e || blank(e.cuitEmisor)) missing.push("Emisor: CUIT");
  if (!e || blank(e.domicilioEmisor)) missing.push("Emisor: domicilio");
  if (!e || blank(e.ingBrutos)) missing.push("Emisor: Ingresos Brutos");
  if (!e || blank(e.inicActEmisor)) missing.push("Emisor: inicio de actividad");

  const t = args.transportista;
  if (!t || blank(t.domicilio)) missing.push("Transportista: domicilio");
  if (!t || blank(t.idFiscal)) missing.push("Transportista: CUIT");
  const tPais = t?.pais ? paisCodigoDesdeTexto(t.pais) : "AR";
  if (!tPais || tPais === "AR") {
    if (t?.condicionIva == null || !Number.isFinite(t.condicionIva)) {
      missing.push("Transportista: condición de IVA (país Argentina + campo AFIP)");
    }
  } else {
    if (blank(t?.condicionTributaria)) {
      missing.push("Transportista: condición tributaria");
    }
  }

  const c = args.cliente;
  if (!c || blank(c.nombre)) missing.push("Cliente: nombre");
  if (!c || blank(c.direccion)) missing.push("Cliente: domicilio");
  if (!c || blank(c.idFiscal)) missing.push("Cliente: CUIT");
  const cPais = c?.pais ? paisCodigoDesdeTexto(c.pais) : "AR";
  if (!cPais || cPais === "AR") {
    if (c?.condicionIva == null || !Number.isFinite(c.condicionIva)) {
      missing.push("Cliente: condición de IVA (país Argentina + campo AFIP)");
    }
  } else {
    if (blank(c?.condicionTributaria)) {
      missing.push("Cliente: condición tributaria");
    }
  }

  return missing;
}

export function formatCvlpEmitMissingMessage(missing: string[]): string | null {
  if (missing.length === 0) return null;
  return `No se puede emitir el comprobante. Faltan datos: ${missing.join("; ")}.`;
}
