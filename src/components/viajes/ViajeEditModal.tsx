import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import {
  ChoferSearchSelect,
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from '@/components/forms/MaestroSearchSelects';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { TransportistaModal } from '@/components/viajes/TransportistaModal';
import { ChoferModal } from '@/components/viajes/ChoferModal';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import {
  ViajeVehiculosLista,
  type ViajeVehiculoRowDraft,
} from '@/components/viajes/ViajeVehiculosLista';
import {
  OtrosGastosFieldset,
  emptyOtroGasto,
  type OtroGastoDraft,
} from '@/components/viajes/OtrosGastosFieldset';
import {
  PagosTransportistaFieldset,
  emptyPagoTransportista,
  type PagoTransportistaDraft,
} from '@/components/viajes/PagosTransportistaFieldset';
import {
  preserveAmountOnMonedaChange,
  maskCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import type { PaisCodigo } from '@/lib/ciudades';
import {
  estadoMuestraKmLitros,
  estadoViajeLabel,
  estadosDisponiblesParaViaje,
  tooltipEstadoViaje,
  viajeEstadoEsFacturadoOCobrado,
  viajeEstadoPermiteBotonFacturar,
} from '@/lib/viajesEstados';
import { numeroFacturaVisibleViaje } from '@/lib/viajesFlota';
import { viajeRequierePagosTransportista } from '@/lib/viajesTransportistaPagos';
import type { Chofer, Cliente, Producto, Transportista, Vehiculo, Viaje } from '@/types/api';
import type { OpcionProducto } from '@/lib/productosViaje';
import { ViajeProductosLista } from '@/components/viajes/ViajeProductosLista';
import { ViajeGananciaBrutaManualFieldset } from '@/components/viajes/ViajeGananciaBrutaManualFieldset';

export type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo;
  choferId: string;
  transportistaId: string;
  vehiculosRows: ViajeVehiculoRowDraft[];
  choferExternoId: string;
  paisOrigen: PaisCodigo;
  paisDestino: PaisCodigo;
  origen: string;
  destino: string;
  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
  productoItems: import('@/lib/productosViaje').ViajeProductoItem[];
  detalleCarga: string;
  observaciones: string;
  monto: string;
  monedaMonto: ViajeMonedaCodigo;
  kmRecorridos: string;
  litrosConsumidos: string;
  precioTransportistaExterno: string;
  monedaPrecioTransportistaExterno: ViajeMonedaCodigo;
  otrosGastos: OtroGastoDraft[];
  pagosTransportista: PagoTransportistaDraft[];
  gananciaBrutaManual: string;
  monedaGananciaBrutaManual: ViajeMonedaCodigo;
  realizaFlete: boolean;
  transportistaEfectivoId: string;
};

export type ViajeEditModalProps = {
  open: boolean;
  draft: ViajeInlineDraft;
  setDraft: Dispatch<SetStateAction<ViajeInlineDraft | null>>;
  /** Viaje del listado (estado / factura en servidor) para opciones de estado */
  snapshotViaje: Viaje;
  opcionesProducto: OpcionProducto[];
  clientes: Cliente[];
  choferes: Chofer[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
  choferesPropios: Chofer[];
  vehiculosPropios: Vehiculo[];
  viajesConFactura: Set<string>;
  onModoChange: (m: ViajeOperacionModo) => void;
  ayudaFlota: { chofer?: string; vehiculo?: string };
  viajeEditHint: string | null;
  fechaCargaError: string | null;
  fechaDescargaError: string | null;
  transportistaEfectivoError?: string | null;
  onClearTransportistaEfectivoError?: () => void;
  onDraftFechasPatch: (
    p: Partial<Pick<ViajeInlineDraft, 'fechaCarga' | 'horaCarga' | 'fechaDescarga' | 'horaDescarga'>>,
  ) => void;
  onClose: () => void;
  onSave: () => void;
  /** Misma acción que «Facturar» en el menú de acciones del listado (navegación / modal de facturas). */
  onFacturar?: () => void;
  onEliminar?: () => void;
  saving: boolean;
  error: string | null;
  /** Enlace «nuevo vehículo» en flota propia (p. ej. con `?tenantId=` para superadmin). */
  crearVehiculoHref?: string;
  getToken?: () => Promise<string | null>;
  tenantId?: string;
  onProductoCreado?: (p: Producto) => void;
  onClienteCreado?: (c: Cliente) => void;
  onTransportistaCreado?: (t: Transportista) => void;
  onChoferCreado?: (c: Chofer) => void;
  onVehiculoCreado?: (v: Vehiculo) => void;
};

const labelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';
const inputClass = 'h-9 border border-black/15 bg-white px-2 text-sm';

export function ViajeEditModal({
  open,
  draft,
  setDraft,
  snapshotViaje,
  opcionesProducto,
  clientes,
  choferes,
  transportistas,
  vehiculos,
  choferesPropios,
  vehiculosPropios,
  viajesConFactura,
  onModoChange,
  ayudaFlota,
  viajeEditHint,
  fechaCargaError,
  fechaDescargaError,
  transportistaEfectivoError,
  onClearTransportistaEfectivoError,
  onDraftFechasPatch,
  onClose,
  onSave,
  onFacturar,
  onEliminar,
  saving,
  error,
  crearVehiculoHref = '/vehiculos/nuevo',
  getToken,
  tenantId,
  onProductoCreado,
  onClienteCreado,
  onTransportistaCreado,
  onChoferCreado,
  onVehiculoCreado,
}: ViajeEditModalProps) {
  type QuickCreate = 'cliente' | 'transportista' | 'chofer-ext' | 'chofer-prop';
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null);
  const [localClientes, setLocalClientes] = useState<Cliente[]>([]);
  const [localTransportistas, setLocalTransportistas] = useState<Transportista[]>([]);
  const [localChoferes, setLocalChoferes] = useState<Chofer[]>([]);
  const [localVehiculos] = useState<Vehiculo[]>([]);

  const todosClientes = useMemo(() => {
    const ids = new Set(clientes.map((c) => c.id));
    return [...clientes, ...localClientes.filter((c) => !ids.has(c.id))];
  }, [clientes, localClientes]);

  const todosTransportistas = useMemo(() => {
    const ids = new Set(transportistas.map((t) => t.id));
    return [...transportistas, ...localTransportistas.filter((t) => !ids.has(t.id))];
  }, [transportistas, localTransportistas]);

  const todosChoferes = useMemo(() => {
    const ids = new Set(choferes.map((c) => c.id));
    return [...choferes, ...localChoferes.filter((c) => !ids.has(c.id))];
  }, [choferes, localChoferes]);

  const todosVehiculos = useMemo(() => {
    const ids = new Set(vehiculos.map((v) => v.id));
    return [...vehiculos, ...localVehiculos.filter((v) => !ids.has(v.id))];
  }, [vehiculos, localVehiculos]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const muestraBotonFacturar =
    typeof onFacturar === 'function' && viajeEstadoPermiteBotonFacturar(draft.estado);
  const facturarDeshabilitado = saving || !draft.clienteId.trim();

  const muestraPagosTransportista = viajeRequierePagosTransportista({
    transportistaId: draft.operacionModo === 'externo' ? draft.transportistaId : '',
  });

  return (
    <>
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar edición"
        disabled={saving}
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viaje-edit-modal-title"
        className="relative flex h-full max-h-[100dvh] w-full max-w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="viaje-edit-modal-title"
              className="truncate text-base font-semibold text-vialto-charcoal"
            >
              Editar viaje {draft.numero}
            </h2>
            <p className="mt-1 text-xs text-vialto-steel">
              Modificá los datos del viaje. Los cambios se aplican al guardar.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <span className={labelClass}>Estado</span>
              <select
                value={draft.estado}
                onChange={(e) =>
                  setDraft((prev) => (prev ? { ...prev, estado: e.target.value } : prev))
                }
                className={`${inputClass} max-w-md`}
              >
                {estadosDisponiblesParaViaje(snapshotViaje, viajesConFactura).map((x) => (
                  <option key={x} value={x} title={tooltipEstadoViaje(x)}>
                    {estadoViajeLabel[x] ?? x}
                  </option>
                ))}
              </select>
              {viajeEstadoEsFacturadoOCobrado(draft.estado) && (
                <span className="text-[10px] font-normal font-[family-name:var(--font-ui)] text-vialto-steel/75 tracking-wide">
                  Factura: {numeroFacturaVisibleViaje(snapshotViaje) || '—'}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <span className={labelClass}>Origen</span>
              <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                <PaisUbicacionSelect
                  value={draft.paisOrigen}
                  onChange={(p) =>
                    setDraft((prev) => (prev ? { ...prev, paisOrigen: p, origen: '' } : prev))
                  }
                  aria-label="País de origen"
                  className={`${inputClass} w-full sm:w-40`}
                />
                <CiudadCombobox
                  pais={draft.paisOrigen}
                  value={draft.origen}
                  onChange={(next) =>
                    setDraft((prev) => (prev ? { ...prev, origen: next } : prev))
                  }
                  inputClassName={`${inputClass} w-full`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <span className={labelClass}>Destino</span>
              <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-end">
                <PaisUbicacionSelect
                  value={draft.paisDestino}
                  onChange={(p) =>
                    setDraft((prev) => (prev ? { ...prev, paisDestino: p, destino: '' } : prev))
                  }
                  aria-label="País de destino"
                  className={`${inputClass} w-full sm:w-40`}
                />
                <CiudadCombobox
                  pais={draft.paisDestino}
                  value={draft.destino}
                  onChange={(next) =>
                    setDraft((prev) => (prev ? { ...prev, destino: next } : prev))
                  }
                  inputClassName={`${inputClass} w-full`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className={labelClass}>Cliente</span>
              <ClienteSearchSelect
                clientes={todosClientes}
                value={draft.clienteId}
                onChange={(id) => setDraft((p) => (p ? { ...p, clienteId: id } : p))}
                inputClassName={inputClass}
                aria-label="Cliente"
                onNuevo={getToken ? () => setQuickCreate('cliente') : undefined}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className={labelClass}>Monto a facturar</span>
              <div className="flex min-w-0 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.monto}
                  onChange={(e) =>
                    setDraft((p) => (p ? { ...p, monto: maskCurrencyForMoneda(e.target.value, p.monedaMonto) } : p))
                  }
                  placeholder="0.00"
                  className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                />
                <MonedaSelect
                  value={draft.monedaMonto}
                  onChange={(m: ViajeMonedaCodigo) =>
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            monedaMonto: m,
                            monto: preserveAmountOnMonedaChange(p.monto, p.monedaMonto, m),
                          }
                        : p,
                    )
                  }
                  aria-label="Moneda monto a facturar"
                />
              </div>
            </div>

            <ViajeOperacionTipoFieldset
              modo={draft.operacionModo}
              onModoChange={onModoChange}
              groupName={`viaje-edit-${draft.numero || 'e'}`}
              externoContent={
                <div className="grid gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>Transportista externo</span>
                      <TransportistaSearchSelect
                        transportistas={todosTransportistas}
                        value={draft.transportistaId}
                        onChange={(id) =>
                          setDraft((p) =>
                            p
                              ? {
                                  ...p,
                                  transportistaId: id,
                                  transportistaEfectivoId:
                                    p.transportistaEfectivoId === id ? '' : p.transportistaEfectivoId,
                                }
                              : p,
                          )
                        }
                        inputClassName={inputClass}
                        aria-label="Transportista externo"
                        onNuevo={getToken ? () => setQuickCreate('transportista') : undefined}
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>Precio transporte</span>
                      <div className="flex min-w-0 gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={draft.precioTransportistaExterno}
                          onChange={(e) =>
                            setDraft((p) => p ? { ...p, precioTransportistaExterno: maskCurrencyForMoneda(e.target.value, p.monedaPrecioTransportistaExterno) } : p)
                          }
                          placeholder="0.00"
                          className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                        />
                        <MonedaSelect
                          value={draft.monedaPrecioTransportistaExterno}
                          onChange={(m: ViajeMonedaCodigo) =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    monedaPrecioTransportistaExterno: m,
                                    precioTransportistaExterno: preserveAmountOnMonedaChange(
                                      p.precioTransportistaExterno,
                                      p.monedaPrecioTransportistaExterno,
                                      m,
                                    ),
                                  }
                                : p,
                            )
                          }
                          aria-label="Moneda precio transportista externo"
                        />
                      </div>
                    </div>
                  </div>
                  {draft.transportistaId && (
                    <div className="flex flex-col gap-2 rounded border border-black/10 bg-vialto-mist/40 px-3 py-3">
                      <span className={labelClass}>¿El transportista seleccionado realiza el flete?</span>
                      <div className="flex gap-5">
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`realiza-flete-edit-${draft.numero || 'e'}`}
                            checked={draft.realizaFlete}
                            onChange={() => {
                              onClearTransportistaEfectivoError?.();
                              setDraft((p) =>
                                p ? { ...p, realizaFlete: true, transportistaEfectivoId: '' } : p,
                              );
                            }}
                            className="accent-vialto-charcoal"
                          />
                          Sí
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`realiza-flete-edit-${draft.numero || 'e'}`}
                            checked={!draft.realizaFlete}
                            onChange={() => {
                              onClearTransportistaEfectivoError?.();
                              setDraft((p) => (p ? { ...p, realizaFlete: false } : p));
                            }}
                            className="accent-vialto-charcoal"
                          />
                          No
                        </label>
                      </div>
                      {!draft.realizaFlete && (
                        <div className="flex min-w-0 flex-col gap-1 mt-1">
                          <span className={labelClass}>
                            Transportista que realiza el flete{' '}
                            <span className="text-red-500">*</span>
                          </span>
                          <TransportistaSearchSelect
                            transportistas={todosTransportistas.filter(
                              (t) => t.id !== draft.transportistaId,
                            )}
                            value={draft.transportistaEfectivoId}
                            onChange={(id) => {
                              onClearTransportistaEfectivoError?.();
                              setDraft((p) =>
                                p ? { ...p, transportistaEfectivoId: id } : p,
                              );
                            }}
                            inputClassName={`${inputClass}${
                              transportistaEfectivoError ? ' border-red-400' : ''
                            }`}
                            aria-label="Transportista que realiza el flete"
                            onNuevo={getToken ? () => setQuickCreate('transportista') : undefined}
                          />
                          {transportistaEfectivoError && (
                            <span className="text-xs text-red-600">{transportistaEfectivoError}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid gap-3">
                    <div className="flex min-w-0 flex-col gap-1 max-w-md">
                      <span className={labelClass}>Chofer</span>
                      <ChoferSearchSelect
                        choferes={todosChoferes}
                        value={draft.choferExternoId}
                        onChange={(id) =>
                          setDraft((p) => (p ? { ...p, choferExternoId: id } : p))
                        }
                        inputClassName={inputClass}
                        aria-label="Chofer transportista externo"
                        onNuevo={getToken ? () => setQuickCreate('chofer-ext') : undefined}
                      />
                    </div>
                    <ViajeVehiculosLista
                      groupId={`viaje-modal-ext-${draft.numero || 'e'}`}
                      crearVehiculoHref={crearVehiculoHref}
                      rows={draft.vehiculosRows}
                      onChange={(rows) => setDraft((p) => (p ? { ...p, vehiculosRows: rows } : p))}
                      vehiculos={todosVehiculos}
                      alMenosUno={false}
                      getToken={getToken}
                      tenantId={tenantId}
                      onVehiculoCreado={onVehiculoCreado}
                      quickCreateStacked
                    />
                  </div>
                </div>
              }
              propioContent={
                <div className="grid gap-3">
                  <div className="flex min-w-0 flex-col gap-1 max-w-md">
                    <span className={labelClass}>Chofer (flota propia)</span>
                    <ChoferSearchSelect
                      choferes={choferesPropios}
                      value={draft.choferId}
                      onChange={(id) => setDraft((p) => (p ? { ...p, choferId: id } : p))}
                      inputClassName={inputClass}
                      aria-label="Chofer flota propia"
                      onNuevo={getToken ? () => setQuickCreate('chofer-prop') : undefined}
                    />
                    {ayudaFlota.chofer && (
                      <p className="text-xs text-amber-800/90">{ayudaFlota.chofer}</p>
                    )}
                  </div>
                  <ViajeVehiculosLista
                    groupId={`viaje-modal-${draft.numero || 'e'}`}
                    crearVehiculoHref={crearVehiculoHref}
                    rows={draft.vehiculosRows}
                    onChange={(rows) => setDraft((p) => (p ? { ...p, vehiculosRows: rows } : p))}
                    vehiculos={vehiculosPropios}
                    getToken={getToken}
                    tenantId={tenantId}
                    onVehiculoCreado={onVehiculoCreado}
                    quickCreateStacked
                  />
                  {ayudaFlota.vehiculo && (
                    <p className="text-xs text-amber-800/90">{ayudaFlota.vehiculo}</p>
                  )}
                  {viajeEditHint && (
                    <p className="text-xs text-amber-800/90">{viajeEditHint}</p>
                  )}
                </div>
              }
            />

            <ViajeGananciaBrutaManualFieldset
              draft={draft}
              onPatch={(p) => setDraft((prev) => (prev ? { ...prev, ...p } : prev))}
              labelClassName={labelClass}
              inputClassName={inputClass}
            />

            <ViajeFechaHoraFields
              fechaCarga={draft.fechaCarga}
              horaCarga={draft.horaCarga}
              fechaDescarga={draft.fechaDescarga}
              horaDescarga={draft.horaDescarga}
              onPatch={onDraftFechasPatch}
              labelClassName={labelClass}
              inputClassName={inputClass}
              errorFechaCarga={fechaCargaError}
              errorFechaDescarga={fechaDescargaError}
            />

            {estadoMuestraKmLitros(draft.estado) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
                <div className="flex flex-col gap-1">
                  <span className={labelClass}>Km recorridos</span>
                  <input
                    type="number"
                    value={draft.kmRecorridos}
                    onChange={(e) =>
                      setDraft((p) => (p ? { ...p, kmRecorridos: e.target.value } : p))
                    }
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className={labelClass}>Litros consumidos</span>
                  <input
                    type="number"
                    value={draft.litrosConsumidos}
                    onChange={(e) =>
                      setDraft((p) => (p ? { ...p, litrosConsumidos: e.target.value } : p))
                    }
                    placeholder="0"
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <span className={labelClass}>Productos</span>
              <ViajeProductosLista
                groupId="viaje-edit"
                value={draft.productoItems}
                onChange={(items) =>
                  setDraft((p) => (p ? { ...p, productoItems: items } : p))
                }
                opciones={opcionesProducto}
                triggerClassName={inputClass}
                inputClassName={inputClass}
                disabled={saving}
                getToken={getToken}
                onProductoCreado={onProductoCreado}
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <span className={labelClass}>Detalle adicional</span>
              <textarea
                value={draft.detalleCarga}
                onChange={(e) =>
                  setDraft((p) => (p ? { ...p, detalleCarga: e.target.value } : p))
                }
                placeholder="Notas extra: bultos, temperatura, precinto, etc."
                className="min-h-24 border border-black/15 bg-white px-2 py-2 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
              <span className={labelClass}>Observaciones</span>
              <textarea
                value={draft.observaciones}
                onChange={(e) =>
                  setDraft((p) => (p ? { ...p, observaciones: e.target.value } : p))
                }
                placeholder="Notas adicionales"
                className="min-h-24 border border-black/15 bg-white px-2 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <OtrosGastosFieldset
                rows={draft.otrosGastos}
                onChange={(rows) => setDraft((p) => (p ? { ...p, otrosGastos: rows } : p))}
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((p) =>
                    p ? { ...p, otrosGastos: [...p.otrosGastos, emptyOtroGasto()] } : p,
                  )
                }
                className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
              >
                + Agregar gasto
              </button>
            </div>

            {muestraPagosTransportista && (
              <div className="md:col-span-2 lg:col-span-3">
                <PagosTransportistaFieldset
                  rows={draft.pagosTransportista}
                  onChange={(rows) =>
                    setDraft((p) => (p ? { ...p, pagosTransportista: rows } : p))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((p) =>
                      p
                        ? { ...p, pagosTransportista: [...p.pagosTransportista, emptyPagoTransportista()] }
                        : p,
                    )
                  }
                  className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
                >
                  + Agregar pago al transportista
                </button>
              </div>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {muestraBotonFacturar ? (
              <button
                type="button"
                onClick={onFacturar}
                disabled={facturarDeshabilitado}
                title={
                  !draft.clienteId.trim()
                    ? 'Elegí un cliente para poder facturar este viaje'
                    : undefined
                }
                className="inline-flex h-10 items-center px-5 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
              >
                Facturar
              </button>
            ) : null}
            {onEliminar ? (
              <button
                type="button"
                onClick={onEliminar}
                disabled={saving}
                className="inline-flex h-10 items-center px-4 text-xs uppercase tracking-wider border border-red-300 bg-white text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar viaje
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </footer>
      </div>
    </div>

    {quickCreate === 'cliente' && getToken && (
      <ClienteModal
        stacked
        getToken={getToken}
        tenantId={tenantId}
        onClose={() => setQuickCreate(null)}
        onSaved={(c) => {
          setLocalClientes((prev) => [...prev, c]);
          onClienteCreado?.(c);
          setDraft((p) => (p ? { ...p, clienteId: c.id } : p));
          setQuickCreate(null);
        }}
      />
    )}
    {quickCreate === 'transportista' && getToken && (
      <TransportistaModal
        stacked
        getToken={getToken}
        tenantId={tenantId}
        onClose={() => setQuickCreate(null)}
        onSaved={(t) => {
          setLocalTransportistas((prev) => [...prev, t]);
          onTransportistaCreado?.(t);
          setDraft((p) => (p ? { ...p, transportistaId: t.id } : p));
          setQuickCreate(null);
        }}
      />
    )}
    {(quickCreate === 'chofer-ext' || quickCreate === 'chofer-prop') && getToken && (
      <ChoferModal
        stacked
        getToken={getToken}
        tenantId={tenantId}
        onClose={() => setQuickCreate(null)}
        onSaved={(c) => {
          setLocalChoferes((prev) => [...prev, c]);
          onChoferCreado?.(c);
          if (quickCreate === 'chofer-ext') {
            setDraft((p) => (p ? { ...p, choferExternoId: c.id } : p));
          } else {
            setDraft((p) => (p ? { ...p, choferId: c.id } : p));
          }
          setQuickCreate(null);
        }}
      />
    )}
    </>
  );
}
