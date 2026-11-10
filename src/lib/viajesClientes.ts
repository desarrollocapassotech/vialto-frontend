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

/**
 * Pisa el país de origen y de cada destino de todas las filas con
 * `paisFijoCodigo` — usado cuando el tenant tiene
 * `paisOrigenDestinoOculto` activo (el selector de país está oculto en la
 * UI, así que lo que se manda a la API tiene que ser siempre el país fijo,
 * sin depender de qué traía el draft).
 */
export function conPaisFijo(
  rows: ViajeClienteDraft[],
  paisFijoCodigo: string,
): ViajeClienteDraft[] {
  return rows.map((row) => ({
    ...row,
    paisOrigen: paisFijoCodigo,
    destinosRows: row.destinosRows.map((d) => ({ ...d, pais: paisFijoCodigo })),
  }));
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

/**
 * Último destino con ciudad cargada de una fila de cliente (recorre desde el
 * final) — usado para sugerir el origen del cliente siguiente en la vuelta.
 */
export function ultimoDestinoCargado(row: ViajeClienteDraft): { pais: PaisCodigo; etiqueta: string } | null {
  const destino = [...row.destinosRows].reverse().find((d) => d.etiqueta.trim());
  return destino ? { pais: destino.pais, etiqueta: destino.etiqueta } : null;
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
 * `validarCiudades = false` (`Tenant.recomendacionCiudadesHabilitada` apagado): origen y
 * destinos en texto libre, sin contrastar con el catálogo.
 */
export type OpcionesValidacionClientes = {
  /**
   * Alta de viaje: toda tarjeta tiene que estar completa (cliente, carga si
   * `exigirCarga`, origen, destino y cobro > 0). Una tarjeta vacía no se saltea: hay
   * que completarla o quitarla. El error lista qué falta en cada una.
   */
  completo?: boolean;
  /** Con `completo`: true = cantidad × tarifa; false = monto. */
  desglose?: boolean;
  /** Con `completo`: cuántas tarjetas del principio son el cliente principal (default 1). */
  principales?: number;
};

/** Campo obligatorio de una tarjeta de cliente que puede faltar (se marca en rojo). */
export type CampoClienteFaltante =
  | 'cliente'
  | 'carga'
  | 'origen'
  | 'destino'
  | 'cantidad'
  | 'tarifa'
  | 'monto';

/**
 * Campos obligatorios que le faltan a una tarjeta en modo `completo` (vacío = completa).
 * Misma regla que el backend (`CreateViajeDto` / `ViajeClienteItemDto`):
 * - Cliente: siempre.
 * - Principal: origen, primer destino y cobro (monto > 0, o cantidad y tarifa).
 * - Adicionales: origen, destino y cobro opcionales; pero cantidad y tarifa van juntas
 *   (si se carga una, falta la otra).
 * La carga nunca es obligatoria.
 */
export function esClientePrincipal(i: number, o: OpcionesValidacionClientes): boolean {
  return i < (o.principales ?? 1);
}

export function faltantesClienteRow(
  row: ViajeClienteDraft,
  o: OpcionesValidacionClientes,
  principal = true,
): CampoClienteFaltante[] {
  const falta: CampoClienteFaltante[] = [];
  if (!row.clienteId.trim()) falta.push('cliente');
  const cantidadOk = (() => {
    const n = Number(row.cantidadStr.replace(',', '.'));
    return row.cantidadStr.trim() !== '' && Number.isFinite(n) && n >= 0;
  })();
  const tarifa = parseCurrencyForMoneda(row.precioUnitarioStr, row.moneda);
  const tarifaOk = row.precioUnitarioStr.trim() !== '' && tarifa != null && tarifa >= 0;
  if (principal) {
    if (!row.origen.trim()) falta.push('origen');
    if (!row.destinosRows.some((d) => d.etiqueta.trim())) falta.push('destino');
    if (o.desglose) {
      if (!cantidadOk) falta.push('cantidad');
      if (!tarifaOk) falta.push('tarifa');
    } else {
      const monto = parseCurrencyForMoneda(row.montoStr, row.moneda);
      if (monto == null || monto <= 0) falta.push('monto');
    }
  } else if (o.desglose && (row.cantidadStr.trim() || row.precioUnitarioStr.trim())) {
    if (!cantidadOk) falta.push('cantidad');
    if (!tarifaOk) falta.push('tarifa');
  }
  return falta;
}

/** Campos faltantes por tarjeta (índice → campos); solo incluye las incompletas. */
export function faltantesPorFila(
  rows: ViajeClienteDraft[],
  opciones: OpcionesValidacionClientes,
): Record<number, CampoClienteFaltante[]> {
  const out: Record<number, CampoClienteFaltante[]> = {};
  rows.forEach((row, i) => {
    const falta = faltantesClienteRow(row, opciones, esClientePrincipal(i, opciones));
    if (falta.length > 0) out[i] = falta;
  });
  return out;
}

/**
 * Modo `completo`, sin las validaciones async (ciudades): null si todas las tarjetas
 * están completas; si no, el aviso corto del pie (los campos se marcan en rojo).
 * Lo usa también "+ Agregar cliente" para no sumar una tarjeta nueva con otras a medias.
 */
export function clientesRowsIncompletos(
  rows: ViajeClienteDraft[],
  opciones: OpcionesValidacionClientes,
): { message: string; rowErrors: Record<number, string> } | null {
  const faltantes = faltantesPorFila(rows, opciones);
  const indices = Object.keys(faltantes);
  if (indices.length === 0) return null;
  const rowErrors: Record<number, string> = {};
  for (const k of indices) rowErrors[Number(k)] = 'Faltan datos.';
  return { message: 'Completá los campos marcados en rojo.', rowErrors };
}

export async function validarClientesRows(
  rows: ViajeClienteDraft[],
  validarCiudades = true,
  opciones: OpcionesValidacionClientes = {},
): Promise<{ ok: true } | { ok: false; message: string; rowErrors: Record<number, string> }> {
  const rowErrors: Record<number, string> = {};
  const seen = new Set<string>();
  if (opciones.completo) {
    // Un solo mensaje con lo que falta en cada tarjeta (el alta no muestra el error
    // dentro de la tarjeta, solo el aviso del pie).
    const incompletos = clientesRowsIncompletos(rows, opciones);
    if (incompletos) return { ok: false, ...incompletos };
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const clienteId = row.clienteId.trim();
    const filaSinUsar =
      !clienteId &&
      !row.origen.trim() &&
      !row.destinosRows.some((d) => d.etiqueta.trim()) &&
      !row.montoStr.trim() &&
      !row.cantidadStr.trim() &&
      !row.precioUnitarioStr.trim();
    if (filaSinUsar) continue;
    if (!clienteId) {
      rowErrors[i] = 'Seleccioná un cliente.';
      continue;
    }
    if (seen.has(clienteId)) {
      rowErrors[i] = 'Este cliente ya está agregado al viaje.';
      continue;
    }
    seen.add(clienteId);

    const origen = row.origen.trim();
    if (origen && validarCiudades) {
      const okOrigen = await esEtiquetaCiudadValida(row.paisOrigen, origen);
      if (!okOrigen) {
        rowErrors[i] = 'El origen debe elegirse de la lista de ciudades (no se admite texto libre).';
        continue;
      }
    }

    const destinosVal = await validarDestinosRows(row.destinosRows, validarCiudades);
    if (!destinosVal.ok) {
      rowErrors[i] = destinosVal.message;
      continue;
    }

    // Alta: en los clientes adicionales el cobro es opcional (igual que en el backend).
    const sinCobro =
      !row.cantidadStr.trim() && !row.precioUnitarioStr.trim() && !row.montoStr.trim();
    if (opciones.completo && !esClientePrincipal(i, opciones) && sinCobro) continue;

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
