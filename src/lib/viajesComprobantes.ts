import { facturacionPermiteVincular, liquidacionPermiteVincular } from '@/lib/viajesIndicadores';
import { transportistaEfectivoIdDesdeViaje } from '@/lib/viajesFlota';
import type { Transportista, Viaje } from '@/types/api';

export type TransportistaLiquidacionOpcion = {
  id: string;
  nombre: string;
  rolLabel: string;
};

/** Viaje con transportista externo: puede requerir factura al cliente y liquidación al transportista. */
export function viajeRequiereComprobanteDual(
  v: Pick<Viaje, 'transportistaId'>,
): boolean {
  return Boolean(String(v.transportistaId ?? '').trim());
}

/** Liquidación activa (no `sin_liquidar` ni `anulado`) que sigue ocupando el viaje. */
export function viajeTieneLiquidacionTransportista(
  v: Pick<Viaje, 'liquidacionEstado'>,
): boolean {
  return v.liquidacionEstado != null && !liquidacionPermiteVincular(v.liquidacionEstado);
}

/** Contratante externo y quien realiza el flete son distintos → elegir beneficiario de la CVLP. */
export function viajePermiteElegirTransportistaLiquidacion(
  v: Pick<
    Viaje,
    'transportistaId' | 'transportistaEfectivoId' | 'transportistaEfectivo'
  >,
): boolean {
  const contratante = String(v.transportistaId ?? '').trim();
  const efectivo = transportistaEfectivoIdDesdeViaje(v);
  return Boolean(contratante && efectivo && contratante !== efectivo);
}

function nombreTransportistaLiquidacion(
  id: string,
  stub: { nombre?: string } | null | undefined,
  transportistas: Transportista[],
): string {
  const desdeStub = stub?.nombre?.trim();
  if (desdeStub) return desdeStub;
  const t = transportistas.find((x) => x.id === id);
  return t?.nombre?.trim() || id;
}

/** Opciones del dropdown al liquidar un viaje (1 o 2 transportistas). */
export function transportistasLiquidacionOpcionesDesdeViaje(
  v: Pick<
    Viaje,
    | 'transportistaId'
    | 'transportista'
    | 'transportistaEfectivoId'
    | 'transportistaEfectivo'
  >,
  transportistas: Transportista[],
): TransportistaLiquidacionOpcion[] {
  const contratanteId = String(v.transportistaId ?? '').trim();
  if (!contratanteId) return [];

  const opciones: TransportistaLiquidacionOpcion[] = [
    {
      id: contratanteId,
      nombre: nombreTransportistaLiquidacion(
        contratanteId,
        v.transportista,
        transportistas,
      ),
      rolLabel: 'Contratante',
    },
  ];

  if (!viajePermiteElegirTransportistaLiquidacion(v)) {
    return opciones;
  }

  const efectivoId = transportistaEfectivoIdDesdeViaje(v);
  opciones.push({
    id: efectivoId,
    nombre: nombreTransportistaLiquidacion(
      efectivoId,
      v.transportistaEfectivo,
      transportistas,
    ),
    rolLabel: 'Realiza el flete',
  });
  return opciones;
}

/** Liquidación no anulada ya emitida a este transportista en el viaje. */
export function viajeTieneLiquidacionActivaParaTransportista(
  v: Pick<Viaje, 'liquidacionesViaje'>,
  transportistaId: string,
): boolean {
  const tid = transportistaId.trim();
  if (!tid) return false;
  for (const lv of v.liquidacionesViaje ?? []) {
    const liq = lv.liquidacion;
    if (!liq || liq.estado === 'anulado') continue;
    const liqTid = String(
      (liq as { transportistaId?: string }).transportistaId ?? '',
    ).trim();
    if (liqTid === tid) return true;
  }
  return false;
}

export function viajePendienteComprobanteCliente(v: Pick<Viaje, 'facturacionEstado' | 'clientesViaje'>): boolean {
  if (facturacionPermiteVincular(v.facturacionEstado)) return true;
  if (v.clientesViaje) {
    for (const c of v.clientesViaje) {
      if (facturacionPermiteVincular(c.facturacionEstado)) return true;
    }
  }
  return false;
}

export function viajePendienteComprobanteTransportista(
  v: Pick<Viaje, 'liquidacionEstado'>,
): boolean {
  return v.liquidacionEstado != null && liquidacionPermiteVincular(v.liquidacionEstado);
}

/**
 * Muestra la acción «Facturar» mientras falte algún comprobante del ciclo financiero.
 * En viajes duales (cliente + transportista), el botón sigue visible si falta uno de los
 * dos — no importa el orden (factura primero o liquidación primero). Facturación y
 * liquidación son indicadores independientes: no se espera uno para completar el otro.
 */
export function viajePermiteBotonFacturar(v: Viaje): boolean {
  if (v.etapa === 'cancelado') return false;

  if (viajeRequiereComprobanteDual(v)) {
    return (
      viajePendienteComprobanteCliente(v) || viajePendienteComprobanteTransportista(v)
    );
  }

  return viajePendienteComprobanteCliente(v);
}

/** Devuelve la liquidación más relevante del viaje (la activa, o la última si todas están anuladas). */
export function liquidacionElegidaDeViaje(viaje: Pick<Viaje, 'liquidacionesViaje'>) {
  const relevantes = viaje.liquidacionesViaje ?? [];
  if (relevantes.length === 0) return undefined;
  const activa = relevantes.find((lv) => lv.liquidacion.estado !== 'anulado');
  return (activa ?? relevantes[relevantes.length - 1])?.liquidacion;
}
