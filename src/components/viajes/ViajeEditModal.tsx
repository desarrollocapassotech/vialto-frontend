import { useEffect, type Dispatch, type SetStateAction } from 'react';
import {
  ChoferSearchSelect,
  ClienteSearchSelect,
  TransportistaSearchSelect,
  VehiculoPatenteSearchSelect,
} from '@/components/forms/MaestroSearchSelects';
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
  type OtroGastoDraft,
} from '@/components/viajes/OtrosGastosFieldset';
import {
  PagosTransportistaFieldset,
  type PagoTransportistaDraft,
} from '@/components/viajes/PagosTransportistaFieldset';
import { maskCurrencyForMoneda, type ViajeMonedaCodigo } from '@/lib/currencyMask';
import type { PaisCodigo } from '@/lib/ciudades';
import {
  estadoMuestraKmLitros,
  estadoViajeLabel,
  estadosDisponiblesParaViaje,
  tooltipEstadoViaje,
  viajeEstadoEsFacturadoOCobrado,
} from '@/lib/viajesEstados';
import { numeroFacturaVisibleViaje } from '@/lib/viajesFlota';
import { viajeRequierePagosTransportista } from '@/lib/viajesTransportistaPagos';
import type { Chofer, Cliente, Transportista, Vehiculo, Viaje } from '@/types/api';

export type ViajeInlineDraft = {
  numero: string;
  estado: string;
  clienteId: string;
  operacionModo: ViajeOperacionModo;
  choferId: string;
  transportistaId: string;
  vehiculosRows: ViajeVehiculoRowDraft[];
  choferExternoId: string;
  vehiculoExternoId: string;
  paisOrigen: PaisCodigo;
  paisDestino: PaisCodigo;
  origen: string;
  destino: string;
  fechaCarga: string;
  horaCarga: string;
  fechaDescarga: string;
  horaDescarga: string;
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
};

export type ViajeEditModalProps = {
  open: boolean;
  draft: ViajeInlineDraft;
  setDraft: Dispatch<SetStateAction<ViajeInlineDraft | null>>;
  /** Viaje del listado (estado / factura en servidor) para opciones de estado */
  snapshotViaje: Viaje;
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
  onDraftFechasPatch: (
    p: Partial<Pick<ViajeInlineDraft, 'fechaCarga' | 'horaCarga' | 'fechaDescarga' | 'horaDescarga'>>,
  ) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
};

const labelClass =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';
const inputClass = 'h-9 border border-black/15 bg-white px-2 text-sm';

export function ViajeEditModal({
  open,
  draft,
  setDraft,
  snapshotViaje,
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
  onDraftFechasPatch,
  onClose,
  onSave,
  saving,
  error,
}: ViajeEditModalProps) {
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

  const muestraPagosTransportista = viajeRequierePagosTransportista({
    transportistaId: draft.operacionModo === 'externo' ? draft.transportistaId : '',
  });

  return (
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
                clientes={clientes}
                value={draft.clienteId}
                onChange={(id) => setDraft((p) => (p ? { ...p, clienteId: id } : p))}
                inputClassName={inputClass}
                aria-label="Cliente"
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
                    setDraft((p) =>
                      p
                        ? {
                            ...p,
                            monto: maskCurrencyForMoneda(e.target.value, p.monedaMonto),
                          }
                        : p,
                    )
                  }
                  placeholder={
                    draft.monedaMonto === 'USD' ? 'Ej. 12,500.50' : 'Ej. 1.500.000,50'
                  }
                  className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                />
                <MonedaSelect
                  value={draft.monedaMonto}
                  onChange={(m: ViajeMonedaCodigo) =>
                    setDraft((p) => (p ? { ...p, monedaMonto: m } : p))
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
                <div className="grid gap-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>Transportista externo</span>
                      <TransportistaSearchSelect
                        transportistas={transportistas}
                        value={draft.transportistaId}
                        onChange={(id) =>
                          setDraft((p) => (p ? { ...p, transportistaId: id } : p))
                        }
                        inputClassName={inputClass}
                        aria-label="Transportista externo"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>Precio transportista externo</span>
                      <div className="flex min-w-0 gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={draft.precioTransportistaExterno}
                          onChange={(e) =>
                            setDraft((p) =>
                              p
                                ? {
                                    ...p,
                                    precioTransportistaExterno: maskCurrencyForMoneda(
                                      e.target.value,
                                      p.monedaPrecioTransportistaExterno,
                                    ),
                                  }
                                : p,
                            )
                          }
                          placeholder={
                            draft.monedaPrecioTransportistaExterno === 'USD'
                              ? 'Ej. 8,500.00'
                              : 'Ej. 1.200.000,50'
                          }
                          className={`${inputClass} min-w-0 flex-1 text-right tabular-nums`}
                        />
                        <MonedaSelect
                          value={draft.monedaPrecioTransportistaExterno}
                          onChange={(m: ViajeMonedaCodigo) =>
                            setDraft((p) =>
                              p ? { ...p, monedaPrecioTransportistaExterno: m } : p,
                            )
                          }
                          aria-label="Moneda precio transportista externo"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>Chofer (opcional)</span>
                      <ChoferSearchSelect
                        choferes={choferes}
                        value={draft.choferExternoId}
                        onChange={(id) =>
                          setDraft((p) => (p ? { ...p, choferExternoId: id } : p))
                        }
                        inputClassName={inputClass}
                        aria-label="Chofer transportista externo"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className={labelClass}>Vehículo (opcional)</span>
                      <VehiculoPatenteSearchSelect
                        vehiculos={vehiculos}
                        value={draft.vehiculoExternoId}
                        onChange={(id) =>
                          setDraft((p) => (p ? { ...p, vehiculoExternoId: id } : p))
                        }
                        sinOpciones={vehiculos.length === 0}
                        inputClassName={inputClass}
                        aria-label="Vehículo transportista externo"
                      />
                    </div>
                  </div>
                </div>
              }
              propioContent={
                <div className="grid gap-3">
                  <div className="flex min-w-0 max-w-md flex-col gap-1">
                    <span className={labelClass}>Chofer (flota propia)</span>
                    <ChoferSearchSelect
                      choferes={choferesPropios}
                      value={draft.choferId}
                      onChange={(id) => setDraft((p) => (p ? { ...p, choferId: id } : p))}
                      inputClassName={inputClass}
                      aria-label="Chofer flota propia"
                    />
                    {ayudaFlota.chofer && (
                      <p className="text-xs text-amber-800/90">{ayudaFlota.chofer}</p>
                    )}
                  </div>
                  <ViajeVehiculosLista
                    groupId={`viaje-modal-${draft.numero || 'e'}`}
                    crearVehiculoHref="/vehiculos/nuevo"
                    rows={draft.vehiculosRows}
                    onChange={(rows) => setDraft((p) => (p ? { ...p, vehiculosRows: rows } : p))}
                    vehiculos={vehiculosPropios}
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
              <span className={labelClass}>Detalle de carga</span>
              <textarea
                value={draft.detalleCarga}
                onChange={(e) =>
                  setDraft((p) => (p ? { ...p, detalleCarga: e.target.value } : p))
                }
                placeholder="Ej. producto, bultos, temperatura, notas sobre la carga"
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
            </div>

            {muestraPagosTransportista && (
              <div className="md:col-span-2 lg:col-span-3">
                <PagosTransportistaFieldset
                  rows={draft.pagosTransportista}
                  onChange={(rows) =>
                    setDraft((p) => (p ? { ...p, pagosTransportista: rows } : p))
                  }
                />
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

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
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
            className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </footer>
      </div>
    </div>
  );
}
