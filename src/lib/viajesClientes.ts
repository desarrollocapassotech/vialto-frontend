import { inferirPaisDesdeUbicacion, esEtiquetaCiudadValida, type PaisCodigo } from '@/lib/ciudades';
import {
  destinosApiDesdeRows,
  emptyDestinoRow,
  validarDestinosRows,
  type ViajeDestinoApiItem,
  type ViajeDestinoRowDraft,
} from '@/lib/viajesDestinos';
import type { ViajeProductoItem } from '@/lib/productosViaje';
import {
  formatNumberForMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import type { Viaje, ViajeCliente } from '@/types/api';

/**
 * Cliente adicional del viaje (multi-cliente, opcional) — mismo shape que el cliente
 * principal del viaje (origen con selector de ciudad, destinos múltiples, productos),
 * convive con él sin reemplazarlo.
 */
export interface ViajeClienteDraft {
  clienteId: string;
  paisOrigen: PaisCodigo;
  origen: string;
  destinosRows: ViajeDestinoRowDraft[];
  productoItems: ViajeProductoItem[];
  montoStr: string;
  moneda: ViajeMonedaCodigo;
  cantidadStr: string;
  precioUnitarioStr: string;
  /** Presente si la fila viene de un viaje existente y ya tiene un cobro vigente (bloquea edición). */
  facturacionEstado?: string;
}

export interface ViajeClienteApiItem {
  clienteId: string;
  origen?: string;
  destinos: ViajeDestinoApiItem[];
  productos: ViajeProductoItem[];
  monto?: number;
  monedaMonto?: string;
  cantidad?: number;
  precioUnitario?: number;
}

export function emptyClienteRow(): ViajeClienteDraft {
  return {
    clienteId: '',
    paisOrigen: 'AR',
    origen: '',
    destinosRows: [emptyDestinoRow()],
    productoItems: [],
    montoStr: '',
    moneda: 'ARS',
    cantidadStr: '',
    precioUnitarioStr: '',
  };
}

/** Filas de formulario a partir de `clientesViaje` del viaje (vacío si es un viaje legacy de un solo cliente). */
export function clientesRowsDesdeViaje(
  v: Pick<Viaje, 'clientesViaje'>,
): ViajeClienteDraft[] {
  const rows = v.clientesViaje ?? [];
  return [...rows]
    .sort((a, b) => a.orden - b.orden)
    .map((c: ViajeCliente) => {
      const moneda: ViajeMonedaCodigo = c.monedaMonto === 'USD' ? 'USD' : 'ARS';
      const destinosCliente = c.destinosCliente ?? [];
      const destinosRows: ViajeDestinoRowDraft[] =
        destinosCliente.length > 0
          ? [...destinosCliente]
              .sort((a, b) => a.orden - b.orden)
              .map((d) => ({ pais: inferirPaisDesdeUbicacion(d.etiqueta), etiqueta: d.etiqueta }))
          : c.destino
            ? [{ pais: inferirPaisDesdeUbicacion(c.destino), etiqueta: c.destino }]
            : [emptyDestinoRow()];
      const productoItems: ViajeProductoItem[] = [...(c.productosCliente ?? [])]
        .sort((a, b) => a.orden - b.orden)
        .map((p) => ({ productoId: p.productoId, cantidad: p.cantidad ?? undefined, pesoKg: p.pesoKg ?? undefined }));
      return {
        clienteId: c.clienteId,
        paisOrigen: inferirPaisDesdeUbicacion(c.origen ?? ''),
        origen: c.origen ?? '',
        destinosRows,
        productoItems,
        montoStr: c.monto != null ? formatNumberForMoneda(c.monto, moneda) : '',
        moneda,
        cantidadStr: c.cantidad != null ? String(c.cantidad) : '',
        precioUnitarioStr:
          c.precioUnitario != null ? formatNumberForMoneda(c.precioUnitario, moneda) : '',
        facturacionEstado: c.facturacionEstado,
      };
    });
}

/**
 * Payload API: descarta filas sin cliente seleccionado. Igual que el monto del viaje
 * (`calcMonto`): si la fila tiene cantidad/precio unitario cargados, manda esos; si no,
 * manda el monto directo — sin selector manual de "forma de cobro" por cliente.
 */
export function clientesPayloadParaApi(rows: ViajeClienteDraft[]): ViajeClienteApiItem[] {
  const out: ViajeClienteApiItem[] = [];
  for (const row of rows) {
    const clienteId = row.clienteId.trim();
    if (!clienteId) continue;
    const item: ViajeClienteApiItem = {
      clienteId,
      origen: row.origen.trim() || undefined,
      destinos: destinosApiDesdeRows(row.destinosRows),
      productos: row.productoItems.filter((p) => p.productoId.trim()),
      monedaMonto: row.moneda,
    };
    if (row.cantidadStr.trim() || row.precioUnitarioStr.trim()) {
      const cantidad = row.cantidadStr.trim() ? Number(row.cantidadStr.replace(',', '.')) : undefined;
      const precioUnitario = parseCurrencyForMoneda(row.precioUnitarioStr, row.moneda);
      if (cantidad != null && Number.isFinite(cantidad)) item.cantidad = cantidad;
      if (precioUnitario != null) item.precioUnitario = precioUnitario;
    } else {
      const monto = parseCurrencyForMoneda(row.montoStr, row.moneda);
      if (monto != null) item.monto = monto;
    }
    out.push(item);
  }
  return out;
}

/**
 * Valida las filas con cliente cargado: origen/destino (misma regla que el cliente principal:
 * ciudad de catálogo, no texto libre) y el cobro (cantidad×precioUnitario o monto, detectado
 * por qué campos tiene cargados la fila — mismo criterio que `clientesPayloadParaApi`).
 */
export async function validarClientesRows(
  rows: ViajeClienteDraft[],
): Promise<{ ok: true } | { ok: false; message: string; rowErrors: Record<number, string> }> {
  const rowErrors: Record<number, string> = {};
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const clienteId = row.clienteId.trim();
    if (!clienteId) continue;
    if (seen.has(clienteId)) {
      rowErrors[i] = 'Este cliente ya está agregado al viaje.';
      continue;
    }
    seen.add(clienteId);

    const origen = row.origen.trim();
    if (origen) {
      const okOrigen = await esEtiquetaCiudadValida(row.paisOrigen, origen);
      if (!okOrigen) {
        rowErrors[i] = 'El origen debe elegirse de la lista de ciudades (no se admite texto libre).';
        continue;
      }
    }

    const destinosVal = await validarDestinosRows(row.destinosRows);
    if (!destinosVal.ok) {
      rowErrors[i] = destinosVal.message;
      continue;
    }

    if (row.cantidadStr.trim() || row.precioUnitarioStr.trim()) {
      const cantidad = Number(row.cantidadStr.replace(',', '.'));
      const precioUnitario = parseCurrencyForMoneda(row.precioUnitarioStr, row.moneda);
      if (!Number.isFinite(cantidad) || cantidad < 0 || precioUnitario == null || precioUnitario < 0) {
        rowErrors[i] = 'Cargá la cantidad y el precio unitario de este cliente.';
      }
    } else {
      const monto = parseCurrencyForMoneda(row.montoStr, row.moneda);
      if (monto == null || monto <= 0) {
        rowErrors[i] = 'Cargá el monto de este cliente.';
      }
    }
  }
  if (Object.keys(rowErrors).length > 0) {
    return { ok: false, message: 'Revisá los datos de los clientes agregados.', rowErrors };
  }
  return { ok: true };
}
