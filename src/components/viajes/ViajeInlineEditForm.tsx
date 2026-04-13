import { useMemo } from 'react';
import {
  ChoferSearchSelect,
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from '@/components/forms/MaestroSearchSelects';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import { ViajeVehiculosLista } from '@/components/viajes/ViajeVehiculosLista';
import { maskCurrencyForMoneda, type ViajeMonedaCodigo } from '@/lib/currencyMask';
import {
  choferesFlotaPropia,
  mensajesAyudaFlotaPropia,
  normalizarIdEnLista,
  vehiculosFlotaPropia,
} from '@/lib/viajesFlota';
import { estadoMuestraKmLitros } from '@/lib/viajesEstados';
import type { Chofer, Cliente, Transportista, Vehiculo } from '@/types/api';
import type { ViajeInlineDraft } from './viajesSuperadminTypes';

type Props = {
  draft: ViajeInlineDraft;
  setDraft: React.Dispatch<React.SetStateAction<ViajeInlineDraft | null>>;
  clientes: Cliente[];
  choferes: Chofer[];
  transportistas: Transportista[];
  vehiculos: Vehiculo[];
  /** Ruta para abrir alta de vehículo en nueva pestaña */
  crearVehiculoHref?: string;
  /** Aviso si el viaje tenía chofer/vehículo incompatible con flota propia al abrir edición. */
  inconsistenciaHint?: string | null;
  tableColSpan: number;
  saving: boolean;
  /** Error de validación o API; se muestra encima de los botones Guardar/Cancelar. */
  formError?: string | null;
  onSave: () => void;
  onCancel: () => void;
};

const LABEL =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';
const INPUT =
  'h-9 border border-black/15 bg-white px-2 text-sm';

export function ViajeInlineEditForm({
  draft,
  setDraft,
  clientes,
  choferes,
  transportistas,
  vehiculos,
  crearVehiculoHref = '/vehiculos/nuevo',
  inconsistenciaHint,
  tableColSpan,
  saving,
  formError,
  onSave,
  onCancel,
}: Props) {
  const choferesPropios = useMemo(() => choferesFlotaPropia(choferes), [choferes]);
  const vehiculosPropios = useMemo(() => vehiculosFlotaPropia(vehiculos), [vehiculos]);
  const ayudaFlota = useMemo(
    () => mensajesAyudaFlotaPropia(choferes, vehiculos),
    [choferes, vehiculos],
  );

  function set(patch: Partial<ViajeInlineDraft>) {
    setDraft((p) => (p ? { ...p, ...patch } : p));
  }

  function applyModo(m: ViajeOperacionModo) {
    setDraft((p) => {
      if (!p) return p;
      return {
        ...p,
        operacionModo: m,
        ...(m === 'externo'
          ? { choferId: '', vehiculosRows: [] }
          : {
              transportistaId: '',
              choferId: normalizarIdEnLista(p.choferId, choferesPropios),
              vehiculosRows:
                p.vehiculosRows.length > 0 ? p.vehiculosRows : [{ tipo: 'tractor', vehiculoId: '' }],
            }),
      };
    });
  }

  return (
    <tr className="border-b border-black/10 bg-vialto-mist/40">
      <td colSpan={tableColSpan} className="px-4 py-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">

          {/* Cliente + Monto */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Cliente</span>
              <ClienteSearchSelect
                clientes={clientes}
                value={draft.clienteId}
                onChange={(id) => set({ clienteId: id })}
                inputClassName={INPUT}
                aria-label="Cliente"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Monto a facturar</span>
              <div className="flex min-w-0 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.monto}
                  onChange={(e) =>
                    set({
                      monto: maskCurrencyForMoneda(e.target.value, draft.monedaMonto),
                    })
                  }
                  placeholder={
                    draft.monedaMonto === 'USD' ? 'Ej. 12,500.50' : 'Ej. 1.500.000,50'
                  }
                  className={`min-w-0 flex-1 ${INPUT} text-right tabular-nums`}
                />
                <MonedaSelect
                  value={draft.monedaMonto}
                  onChange={(m: ViajeMonedaCodigo) =>
                    set({ monedaMonto: m, monto: '' })
                  }
                  aria-label="Moneda monto a facturar"
                />
              </div>
            </div>
          </div>

          {/* Operación: externo o flota propia */}
          <ViajeOperacionTipoFieldset
            modo={draft.operacionModo}
            onModoChange={applyModo}
            groupName={`viaje-op-sa-${draft.numero || 'edit'}`}
            externoContent={
              <div className="grid gap-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={LABEL}>Transportista externo</span>
                    <TransportistaSearchSelect
                      transportistas={transportistas}
                      value={draft.transportistaId}
                      onChange={(id) => set({ transportistaId: id })}
                      inputClassName={INPUT}
                      aria-label="Transportista externo"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={LABEL}>Precio transportista externo</span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft.precioTransportistaExterno}
                        onChange={(e) =>
                          set({
                            precioTransportistaExterno: maskCurrencyForMoneda(
                              e.target.value,
                              draft.monedaPrecioTransportistaExterno,
                            ),
                          })
                        }
                        placeholder={
                          draft.monedaPrecioTransportistaExterno === 'USD'
                            ? 'Ej. 8,500.00'
                            : 'Ej. 1.200.000,50'
                        }
                        className={`min-w-0 flex-1 ${INPUT} text-right tabular-nums`}
                      />
                      <MonedaSelect
                        value={draft.monedaPrecioTransportistaExterno}
                        onChange={(m: ViajeMonedaCodigo) =>
                          set({ monedaPrecioTransportistaExterno: m, precioTransportistaExterno: '' })
                        }
                        aria-label="Moneda precio transportista externo"
                      />
                    </div>
                  </div>
                </div>
              </div>
            }
            propioContent={
              <div className="grid gap-3">
                <div className="flex min-w-0 max-w-md flex-col gap-1">
                  <span className={LABEL}>Chofer (flota propia)</span>
                  <ChoferSearchSelect
                    choferes={choferesPropios}
                    value={draft.choferId}
                    onChange={(id) => set({ choferId: id })}
                    inputClassName={INPUT}
                    aria-label="Chofer flota propia"
                  />
                  {ayudaFlota.chofer && (
                    <p className="text-xs text-amber-800/90">{ayudaFlota.chofer}</p>
                  )}
                </div>
                <ViajeVehiculosLista
                  groupId={`viaje-sa-${draft.numero || 'e'}`}
                  crearVehiculoHref={crearVehiculoHref}
                  rows={draft.vehiculosRows}
                  onChange={(rows) => set({ vehiculosRows: rows })}
                  vehiculos={vehiculosPropios}
                />
                {ayudaFlota.vehiculo && (
                  <p className="text-xs text-amber-800/90">{ayudaFlota.vehiculo}</p>
                )}
                {inconsistenciaHint ? (
                  <p className="text-xs text-amber-800/90">{inconsistenciaHint}</p>
                ) : null}
              </div>
            }
          />

          <ViajeFechaHoraFields
            fechaCarga={draft.fechaCarga}
            horaCarga={draft.horaCarga}
            fechaDescarga={draft.fechaDescarga}
            horaDescarga={draft.horaDescarga}
            onPatch={(p) => set(p)}
            labelClassName={LABEL}
            inputClassName={INPUT}
          />

          {/* Km / Litros (solo en estados finales) */}
          {estadoMuestraKmLitros(draft.estado) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
              <div className="flex flex-col gap-1">
                <span className={LABEL}>Km recorridos</span>
                <input
                  type="number"
                  value={draft.kmRecorridos}
                  onChange={(e) => set({ kmRecorridos: e.target.value })}
                  placeholder="0"
                  className={INPUT}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className={LABEL}>Litros consumidos</span>
                <input
                  type="number"
                  value={draft.litrosConsumidos}
                  onChange={(e) => set({ litrosConsumidos: e.target.value })}
                  placeholder="0"
                  className={INPUT}
                />
              </div>
            </div>
          )}

          {/* Detalle de carga */}
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={LABEL}>Detalle de carga</span>
            <textarea
              value={draft.detalleCarga}
              onChange={(e) => set({ detalleCarga: e.target.value })}
              placeholder="Ej. producto, bultos, temperatura, notas sobre la carga"
              className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm"
            />
          </div>

          {/* Observaciones */}
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={LABEL}>Observaciones</span>
            <textarea
              value={draft.observaciones}
              onChange={(e) => set({ observaciones: e.target.value })}
              placeholder="Notas adicionales"
              className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm"
            />
          </div>
        </div>

        {formError && (
          <p role="alert" className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {formError}
          </p>
        )}

        {/* Acciones del form */}
        <div className="mt-3 inline-flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="text-xs uppercase tracking-wider px-3 py-1 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}
