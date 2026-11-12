import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { PaisSearchSelect } from '@/components/forms/PaisSearchSelect';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { ViajeDestinosLista } from '@/components/viajes/ViajeDestinosLista';
import { ViajeProductosLista } from '@/components/viajes/ViajeProductosLista';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { maskCurrencyForMoneda, parseCurrencyForMoneda, preserveAmountOnMonedaChange } from '@/lib/currencyMask';
import { textoRutaViaje } from '@/lib/viajesDestinos';
import {
  ultimoDestinoCargado,
  type CampoClienteFaltante,
  type ViajeClienteDraft,
} from '@/lib/viajesClientes';
import { conBordeError } from '@/lib/bordeError';
import { FaltaCampo } from '@/components/shared/FaltaCampo';
import { facturacionPermiteVincular } from '@/lib/viajesIndicadores';
import type { OpcionProducto } from '@/lib/productosViaje';
import type { Cliente, Pais, Producto } from '@/types/api';

const fieldLabelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';
const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const autocompletarBtnClass =
  'text-[11px] text-vialto-steel underline decoration-dotted underline-offset-2 hover:text-vialto-fire';

/** Monto formateado para el resumen colapsado, o '' si todavía no hay monto cargado. */
function formatClienteMontoSummary(row: ViajeClienteDraft, desgloseActivo: boolean): string {
  let monto: number | undefined;
  if (desgloseActivo) {
    const cantidad = Number(row.cantidadStr.replace(',', '.'));
    const precioUnitario = parseCurrencyForMoneda(row.precioUnitarioStr, row.moneda);
    monto = Number.isFinite(cantidad) && cantidad > 0 && precioUnitario != null ? cantidad * precioUnitario : undefined;
  } else {
    monto = parseCurrencyForMoneda(row.montoStr, row.moneda);
  }
  if (!monto) return '';
  return `${row.moneda} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Tarjeta colapsable genérica para un cliente del viaje (principal o adicional) —
 * colapsada muestra solo el resumen (cliente + ruta), expandida muestra los campos.
 */
export function ClienteCard({
  title,
  summary,
  summaryRight,
  removable,
  onRemove,
  defaultOpen = true,
  open: openProp,
  onToggle: onToggleProp,
  numero,
  children,
}: {
  title: string;
  /** Número de la tarjeta (1, 2…): se muestra en un círculo para distinguir un cliente de otro. */
  numero?: number;
  summary?: string;
  /** Dato corto (ej. monto) alineado a la derecha del resumen colapsado, separado del texto de ruta. */
  summaryRight?: string;
  removable?: boolean;
  onRemove?: () => void;
  /** Estado inicial cuando el open/close no es controlado (ver `open`/`onToggle`). */
  defaultOpen?: boolean;
  /** Si se pasa junto con `onToggle`, el open/close pasa a ser controlado por el padre. */
  open?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : internalOpen;
  const toggle = controlado ? onToggleProp! : () => setInternalOpen((o) => !o);
  return (
    // Con `numero` (clientes del viaje): borde de acento a la izquierda, encabezado
    // marcado y más separación, para que cada cliente se lea como un bloque propio.
    // Sin número (ej. Otros gastos) queda el estilo liviano de siempre.
    <div
      className={
        numero != null
          ? "mb-5 overflow-hidden rounded-md border border-black/15 border-l-4 border-l-vialto-fire bg-white shadow-sm last:mb-0"
          : "mb-3 border border-black/10 last:mb-0"
      }
    >
      <div
        className={
          numero != null
            ? "flex items-center gap-2 border-b border-black/10 bg-vialto-mist px-3 py-2.5"
            : "flex items-center gap-2 bg-vialto-mist/40 px-3 py-2"
        }
      >
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span
            className={`shrink-0 text-vialto-steel transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden
          >
            ▸
          </span>
          {numero != null && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-vialto-fire text-xs font-semibold text-white">
              {numero}
            </span>
          )}
          <span className="shrink-0 text-sm font-semibold text-vialto-charcoal">{title}</span>
          {!open && summary && (
            <span className="min-w-0 flex-1 truncate text-xs text-vialto-steel">{summary}</span>
          )}
          {!open && summaryRight && (
            <span className="shrink-0 text-xs font-medium text-vialto-charcoal">{summaryRight}</span>
          )}
        </button>
        {removable && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 active:bg-red-100"
            aria-label={`Quitar ${title}`}
          >
            ✕
          </button>
        )}
      </div>
      {open && <div className="p-3">{children}</div>}
    </div>
  );
}

interface Props {
  rows: ViajeClienteDraft[];
  onChange: (rows: ViajeClienteDraft[]) => void;
  clientes: Cliente[];
  rowErrors?: Record<number, string>;
  /** Dentro de un modal: el texto de `rowErrors` va en el pie (`ErrorPieModal`), no en la fila. */
  ocultarTextoError?: boolean;
  className?: string;
  desgloseActivo: boolean;
  paises: Pais[];
  paisesLoading: boolean;
  onNuevoPaisOrigen: (clienteIndex: number) => void;
  onNuevoPaisDestino: (clienteIndex: number, destinoIndex: number) => void;
  /**
   * Si se pasa, el país de origen/destino queda fijo a este país (config de
   * superadmin `Tenant.paisOrigenDestinoOculto`): no se muestra el selector
   * de país en ninguna fila, solo el buscador de ciudad.
   */
  paisFijo?: Pais | null;
  /** Si se pasa, agrega "+ Nuevo cliente" al selector de cada fila. */
  onNuevoCliente?: (clienteIndex: number) => void;
  opcionesProducto: OpcionProducto[];
  getToken?: () => Promise<string | null>;
  onProductoCreado?: (p: Producto) => void;
  /** Filas con índice menor a este valor no muestran botón "Quitar" (mínimo de filas del viaje). Default 0. */
  minRows?: number;
  /** Prefijo del título cuando no hay nombre de cliente cargado (ej. "Cliente" vs "Cliente adicional"). */
  labelPrefix?: string;
  /** Si se muestra la sección de Carga (productos) por fila. Default true. */
  mostrarProductos?: boolean;
  /** `Tenant.recomendacionCiudadesHabilitada`: false = origen/destinos en texto libre. */
  sugerenciasCiudad?: boolean;
  /** Label de la cantidad con desglose: "Toneladas" o "Cantidad" (`labelCantidadViajes`). */
  labelCantidad?: string;
  /** Número de la primera tarjeta (default 1). En edición el principal es el 1 y estos siguen desde 2. */
  numeroInicial?: number;
  /** Campos que faltan por tarjeta: borde rojo + "Falta completar" debajo (ver `faltantesPorFila`). */
  camposFaltantes?: Record<number, CampoClienteFaltante[]>;
  /** true = las tarjetas arrancan colapsadas (edición). Un cliente que se agrega se abre igual. */
  inicialColapsados?: boolean;
}

/**
 * Lista de clientes del viaje: cada fila tiene los mismos campos (cliente, origen con
 * ciudad de catálogo, destinos múltiples, productos, cobro por cantidad×precioUnitario
 * o monto según `desgloseActivo`), sin distinción entre "cliente principal" y
 * "adicionales" — todas las filas se validan y muestran igual.
 */
export function ViajeClientesFieldset({
  rows,
  onChange,
  clientes,
  rowErrors,
  ocultarTextoError = false,
  className,
  desgloseActivo,
  paises,
  paisesLoading,
  onNuevoPaisOrigen,
  onNuevoPaisDestino,
  onNuevoCliente,
  opcionesProducto,
  getToken,
  onProductoCreado,
  minRows = 0,
  labelPrefix = 'Cliente adicional',
  mostrarProductos = true,
  paisFijo = null,
  sugerenciasCiudad = true,
  labelCantidad = 'Cantidad',
  numeroInicial = 1,
  camposFaltantes,
  inicialColapsados = false,
}: Props) {
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(
    () => (inicialColapsados ? new Set() : new Set(rows.map((_, idx) => idx))),
  );
  const prevRowsLengthRef = useRef(rows.length);

  useEffect(() => {
    if (rows.length > prevRowsLengthRef.current) {
      // Se agregó un cliente nuevo: colapsa el resto y deja expandido solo el último.
      setOpenIndexes(new Set([rows.length - 1]));
    } else if (rows.length < prevRowsLengthRef.current) {
      setOpenIndexes((prev) => new Set([...prev].filter((idx) => idx < rows.length)));
    }
    prevRowsLengthRef.current = rows.length;
  }, [rows.length]);

  // Tarjetas con campos marcados en rojo: se abren para que se vea qué falta.
  const clavesFaltantes = Object.keys(camposFaltantes ?? {}).join(",");
  useEffect(() => {
    if (!clavesFaltantes) return;
    setOpenIndexes((prev) => new Set([...prev, ...clavesFaltantes.split(",").map(Number)]));
  }, [clavesFaltantes]);

  function toggleOpen(i: number) {
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function update(i: number, patch: Partial<ViajeClienteDraft>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function confirmRemove() {
    if (removeIndex === null) return;
    const i = removeIndex;
    setRemoveIndex(null);
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className={className}>
      {rows.map((row, i) => {
        const bloqueado = !!row.facturacionEstado && !facturacionPermiteVincular(row.facturacionEstado);
        const nombre = clientes.find((c) => c.id === row.clienteId)?.nombre;
        // Sugerencias "para la vuelta": solo tienen sentido a partir del 2do cliente.
        const sugerenciaOrigen = i > 0 ? ultimoDestinoCargado(rows[i - 1]) : null;
        const primero = rows[0];
        const sugerenciaDestino =
          i > 0 && primero?.origen.trim() ? { pais: primero.paisOrigen, etiqueta: primero.origen } : null;
        const summary = textoRutaViaje(row.origen, row.destinosRows.map((r) => r.etiqueta).filter(Boolean));
        const summaryMonto = formatClienteMontoSummary(row, desgloseActivo);
        const faltan = camposFaltantes?.[i] ?? [];
        const falta = (campo: CampoClienteFaltante) => faltan.includes(campo);
        // Cliente principal (alta: la 1ª tarjeta): origen, destino y cobro obligatorios,
        // igual que en el backend. En los adicionales solo el cliente.
        const principal = i < minRows;
        return (
          <ClienteCard
            key={i}
            numero={numeroInicial + i}
            title={nombre || `${labelPrefix} ${i + 1}`}
            summary={summary}
            summaryRight={summaryMonto}
            removable={!bloqueado && i >= minRows}
            onRemove={() => setRemoveIndex(i)}
            open={openIndexes.has(i)}
            onToggle={() => toggleOpen(i)}
          >
            {/* Dos columnas cuando la tarjeta es ancha (alta de viaje): Cliente | Carga,
                Origen | Destino y la cantidad/tarifa a todo el ancho (con `order`, así en
                contenedores angostos —modal de edición— sigue el orden de siempre). */}
            <div className="@container">
            <div className="grid grid-cols-1 items-start gap-3 @3xl:grid-cols-2 @3xl:gap-x-5">
              <div className="flex min-w-0 flex-col gap-1 @3xl:order-1">
                <span className={fieldLabelClass}>
                  Cliente <span className="text-red-500">*</span>
                </span>
                <ClienteSearchSelect
                  clientes={clientes}
                  value={row.clienteId}
                  onChange={(id) => update(i, { clienteId: id })}
                  inputClassName={conBordeError(inputClass, falta('cliente'))}
                  disabled={bloqueado}
                  aria-label={`${labelPrefix} ${i + 1}`}
                  onNuevo={onNuevoCliente ? () => onNuevoCliente(i) : undefined}
                />
                <FaltaCampo show={falta('cliente')} />
              </div>
              <div className="flex min-w-0 flex-col gap-1 @3xl:order-3">
                <div className="flex items-center gap-2">
                  <span className={fieldLabelClass}>
                    Origen {principal && <span className="text-red-500">*</span>}
                  </span>
                  {sugerenciaOrigen && !row.origen.trim() && (
                    <button
                      type="button"
                      onClick={() => update(i, { paisOrigen: sugerenciaOrigen.pais, origen: sugerenciaOrigen.etiqueta })}
                      className={autocompletarBtnClass}
                      title={`Autocompletar con ${sugerenciaOrigen.etiqueta}`}
                    >
                      ↺ Autocompletar con {sugerenciaOrigen.etiqueta}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {!paisFijo && (
                    <PaisSearchSelect
                      paises={paises}
                      loading={paisesLoading}
                      value={row.paisOrigen}
                      onChange={(p) => update(i, { paisOrigen: p, origen: '' })}
                      aria-label={`País de origen del cliente ${i + 1}`}
                      className="w-full sm:w-40"
                      inputClassName={inputClass}
                      disabled={bloqueado}
                      onNuevo={() => onNuevoPaisOrigen(i)}
                    />
                  )}
                  <div className="min-w-[200px] flex-1">
                    <CiudadCombobox
                      campo="origen"
                      pais={paisFijo ? (paisFijo.codigo || paisFijo.id) : row.paisOrigen}
                      paisNombre={
                        paisFijo
                          ? paisFijo.nombre
                          : paises.find((p) => (p.codigo || p.id) === row.paisOrigen)?.nombre
                      }
                      value={row.origen}
                      onChange={(next) => update(i, { origen: next })}
                      inputClassName={inputClass}
                      error={falta('origen')}
                      disableBrowserAutocomplete
                      sugerencias={sugerenciasCiudad}
                    />
                  </div>
                </div>
                <FaltaCampo show={falta('origen')} />
              </div>
              <div className="flex min-w-0 flex-col gap-1 @3xl:order-4">
                <ViajeDestinosLista
                  groupId={`viaje-cliente-${i}`}
                  rows={row.destinosRows}
                  onChange={(destinosRows) => update(i, { destinosRows })}
                  inputClassName={inputClass}
                  disableBrowserAutocomplete
                  paises={paises}
                  paisesLoading={paisesLoading}
                  onNuevoPais={(destinoIndex) => onNuevoPaisDestino(i, destinoIndex)}
                  paisFijo={paisFijo}
                  sugerenciaPrimerDestino={sugerenciaDestino}
                  sugerenciasCiudad={sugerenciasCiudad}
                  errorPrimerDestino={falta('destino')}
                  requerido={principal}
                />
              </div>
              {mostrarProductos && (
                <div className="flex min-w-0 flex-col gap-1 @3xl:order-2">
                  <span className={fieldLabelClass}>Carga</span>
                  <ViajeProductosLista
                    groupId={`viaje-cliente-${i}`}
                    value={row.productoItems}
                    onChange={(productoItems) => update(i, { productoItems })}
                    opciones={opcionesProducto}
                    triggerClassName={inputClass}
                    inputClassName={inputClass}
                    disabled={bloqueado}
                    getToken={getToken}
                    onProductoCreado={onProductoCreado}
                    error={falta('carga')}
                  />
                </div>
              )}
              {desgloseActivo ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6rem_minmax(0,3fr)_minmax(0,2fr)] @3xl:order-5 @3xl:col-span-2">
                  <div className="flex flex-col gap-1">
                    <span className={fieldLabelClass}>
                      {labelCantidad}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.cantidadStr}
                      onChange={(e) => update(i, { cantidadStr: e.target.value })}
                      disabled={bloqueado}
                      placeholder="0"
                      className={`${conBordeError(inputClass, falta('cantidad'))} text-right tabular-nums`}
                      aria-label={`${labelCantidad} del cliente ${i + 1}`}
                    />
                    <FaltaCampo show={falta('cantidad')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={fieldLabelClass}>
                      Tarifa
                    </span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.precioUnitarioStr}
                        onChange={(e) =>
                          update(i, { precioUnitarioStr: maskCurrencyForMoneda(e.target.value, row.moneda) })
                        }
                        disabled={bloqueado}
                        placeholder="0.00"
                        className={`${conBordeError(inputClass, falta('tarifa'))} min-w-0 flex-1 text-right tabular-nums`}
                        aria-label={`Tarifa del cliente ${i + 1}`}
                      />
                      <MonedaSelect
                        value={row.moneda}
                        onChange={(m) => update(i, { moneda: m })}
                        disabled={bloqueado}
                        aria-label={`Moneda del cliente ${i + 1}`}
                      />
                    </div>
                    <FaltaCampo show={falta('tarifa')} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`${fieldLabelClass} text-right`}>Total</span>
                    {/* Calculado: se muestra como número, no como input deshabilitado. */}
                    <div className="flex h-9 items-center text-right text-base font-semibold tabular-nums text-vialto-charcoal">
                      <span className="w-full truncate">
                        {row.cantidadStr.trim() && row.precioUnitarioStr.trim() ? (
                          `$ ${(
                            (Number(row.cantidadStr.replace(",", ".")) || 0) *
                            (parseCurrencyForMoneda(row.precioUnitarioStr, row.moneda) || 0)
                          ).toLocaleString("es-AR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        ) : (
                          <span className="text-xs font-normal text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            Pendiente
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 flex-col gap-1 @3xl:order-5">
                  <span className={fieldLabelClass}>
                    Monto
                  </span>
                  <div className="flex min-w-0 gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.montoStr}
                      onChange={(e) =>
                        update(i, { montoStr: maskCurrencyForMoneda(e.target.value, row.moneda) })
                      }
                      disabled={bloqueado}
                      placeholder="0.00"
                      className={`${conBordeError(inputClass, falta('monto'))} min-w-0 flex-1 text-right tabular-nums`}
                      aria-label={`Monto del cliente ${i + 1}`}
                    />
                    <MonedaSelect
                      value={row.moneda}
                      onChange={(m) =>
                        update(i, {
                          moneda: m,
                          montoStr: preserveAmountOnMonedaChange(row.montoStr, row.moneda, m),
                        })
                      }
                      disabled={bloqueado}
                      aria-label={`Moneda del cliente ${i + 1}`}
                    />
                  </div>
                  <FaltaCampo show={falta('monto')} />
                </div>
              )}
            </div>
            </div>
            {rowErrors?.[i] && !ocultarTextoError && (
              <p className="mt-2 text-xs font-medium text-red-600">{rowErrors[i]}</p>
            )}
          </ClienteCard>
        );
      })}
      <ConfirmDialog
        open={removeIndex !== null}
        title="Quitar cliente"
        message="¿Quitás este cliente del viaje?"
        confirmLabel="Quitar"
        tone="danger"
        onCancel={() => setRemoveIndex(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
