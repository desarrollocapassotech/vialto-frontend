import { esPaisSoportado, type PaisCodigo } from '@/lib/ciudades';

export type MicCrtActor = {
  razonSocial: string;
  idFiscal: string;
  calle: string;
  numero: string;
  ciudad: string;
  pais: string;
};

const PAIS_DEFAULT: PaisCodigo = 'AR';

function normalizePaisCodigo(raw: string | null | undefined): PaisCodigo {
  const t = (raw ?? '').trim();
  if (esPaisSoportado(t)) return t;
  const upper = t.toUpperCase();
  if (upper === 'ARGENTINA') return 'AR';
  if (upper === 'URUGUAY') return 'UY';
  if (upper === 'PARAGUAY') return 'PY';
  if (upper === 'CHILE') return 'CL';
  if (upper === 'BRASIL' || upper === 'BRAZIL') return 'BR';
  return PAIS_DEFAULT;
}

/** Alinea actores con el prefill del API (direccion/domicilio, país vacío, etc.). */
export function normalizeMicCrtActor(
  actor: MicCrtActor,
  ciudadFallback?: string | null,
): MicCrtActor {
  const extra = actor as MicCrtActor & { direccion?: string; domicilio?: string; localidad?: string };
  const calle =
    actor.calle?.trim() ||
    extra.direccion?.trim() ||
    extra.domicilio?.trim() ||
    '';
  const ciudad = actor.ciudad?.trim() || extra.localidad?.trim() || ciudadFallback?.trim() || '';
  return {
    ...actor,
    razonSocial: actor.razonSocial?.trim() ?? '',
    idFiscal: actor.idFiscal?.trim() ?? '',
    calle,
    numero: actor.numero?.trim() ?? '',
    ciudad,
    pais: normalizePaisCodigo(actor.pais),
  };
}

export function normalizeMicCrtPayload(
  payload: MicCrtExportPayload,
  operativo?: MicCrtPrefillResponse['operativo'],
): MicCrtExportPayload {
  const partidaPaisRaw = payload.partidaPais?.trim() ?? '';
  return {
    ...payload,
    remitente: normalizeMicCrtActor(payload.remitente, operativo?.origen),
    destinatario: normalizeMicCrtActor(payload.destinatario, operativo?.destino),
    consignatario: normalizeMicCrtActor(payload.consignatario, operativo?.destino),
    porteadorPais: payload.porteadorPais?.trim()
      ? normalizePaisCodigo(payload.porteadorPais)
      : PAIS_DEFAULT,
    aduanaPartida: payload.aduanaPartida?.trim() ?? '',
    partidaPais: partidaPaisRaw ? normalizePaisCodigo(partidaPaisRaw) : '',
    aduanaEspecificaPartida: payload.aduanaEspecificaPartida?.trim() ?? '',
    codigoLugarOperativoPartida: payload.codigoLugarOperativoPartida?.trim() ?? '',
    aduanaDestino: payload.aduanaDestino?.trim() ?? '',
    origenComercial:
      payload.origenComercial?.trim() ?? operativo?.origen?.trim() ?? '',
  };
}

/** Body POST/PDF: siempre incluye los cuatro campos de partida (MIC campo 7), aunque estén vacíos. */
export function micCrtExportBodyForApi(payload: MicCrtExportPayload): MicCrtExportPayload {
  const n = normalizeMicCrtPayload(payload);
  return {
    ...n,
    aduanaPartida: n.aduanaPartida ?? '',
    partidaPais: n.partidaPais ?? '',
    aduanaEspecificaPartida: n.aduanaEspecificaPartida ?? '',
    codigoLugarOperativoPartida: n.codigoLugarOperativoPartida ?? '',
    aduanaDestino: n.aduanaDestino ?? '',
    origenComercial: n.origenComercial ?? '',
  };
}

export type MicCrtSemirremolque = {
  propietario?: string;
  idFiscal?: string;
  patente?: string;
  marca?: string;
  anio?: number;
  capacidadArrastreT?: number;
};

export type MicCrtExportPayload = {
  micNumero: string;
  crtNumero: string;
  fechaEmision: string;
  remitente: MicCrtActor;
  destinatario: MicCrtActor;
  consignatario: MicCrtActor;
  notificarA?: MicCrtActor;
  ncm: string;
  bultos: number;
  tipoBultos: string;
  pesoBrutoKg: number;
  volumenM3?: number;
  valorFot: number;
  monedaFot: 'ARS' | 'USD';
  flete: number;
  monedaFlete: 'ARS' | 'USD';
  seguroUsd?: number;
  condicionPago: 'origen' | 'destino';
  /** Ciudad / lugar de partida (MIC campo 7). */
  aduanaPartida: string;
  /** País de partida (código ISO, ej. AR). */
  partidaPais?: string;
  /** Nombre o código de la aduana de partida. */
  aduanaEspecificaPartida?: string;
  /** Código o lugar operativo de partida. */
  codigoLugarOperativoPartida?: string;
  aduanaDestino: string;
  /** Origen comercial de la mercadería (MIC campo 26). */
  origenComercial?: string;
  documentosAnexos?: string;
  precintos?: string;
  cartaPorte?: string;
  ruta?: string;
  descripcionMercaderias?: string;
  semirremolque?: MicCrtSemirremolque;
  porteadorDomicilio?: string;
  porteadorPais?: string;
  monedaDocumento?: 'ARS' | 'USD';
};

export type MicCrtPrefillResponse = {
  viajeId: string;
  viajeNumero: string;
  tiposBultos: readonly string[];
  prefill: MicCrtExportPayload;
  operativo: {
    origen: string | null;
    destino: string | null;
    clienteNombre: string | null;
    transportistaNombre: string | null;
    placaCamion: string | null;
    conductorNombre: string | null;
  };
};

export const TIPOS_BULTOS_MIC = [
  'PALETA',
  'CAJA',
  'BOLSA',
  'TAMBOR',
  'CONTENEDOR',
  'BULTO',
  'OTRO',
] as const;
