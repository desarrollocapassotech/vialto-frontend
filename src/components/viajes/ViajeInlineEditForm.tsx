import { useMemo } from 'react';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { maskCurrencyArInput } from '@/lib/currencyMask';
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
  /** Aviso si el viaje tenía chofer/vehículo incompatible con flota propia al abrir edición. */
  inconsistenciaHint?: string | null;
  tableColSpan: number;
  saving: boolean;
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
  inconsistenciaHint,
  tableColSpan,
  saving,
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
          ? { choferId: '', vehiculoId: '' }
          : {
              transportistaId: '',
              choferId: normalizarIdEnLista(p.choferId, choferesPropios),
              vehiculoId: normalizarIdEnLista(p.vehiculoId, vehiculosPropios),
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
              <select
                value={draft.clienteId}
                onChange={(e) => set({ clienteId: e.target.value })}
                className={INPUT}
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Monto a facturar</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={draft.monto}
                onChange={(e) => set({ monto: maskCurrencyArInput(e.target.value) })}
                placeholder="Ej. 1.500.000,50"
                className={`${INPUT} text-right tabular-nums`}
              />
            </div>
          </div>

          {/* Operación: externo o flota propia */}
          <ViajeOperacionTipoFieldset
            modo={draft.operacionModo}
            onModoChange={applyModo}
            groupName={`viaje-op-sa-${draft.numero || 'edit'}`}
            externoContent={
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={LABEL}>Transportista externo</span>
                    <select
                      value={draft.transportistaId}
                      onChange={(e) => set({ transportistaId: e.target.value })}
                      className={INPUT}
                    >
                      <option value="">Elegí un transportista…</option>
                      {transportistas.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={LABEL}>Precio transportista externo</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={draft.precioTransportistaExterno}
                      onChange={(e) =>
                        set({ precioTransportistaExterno: maskCurrencyArInput(e.target.value) })
                      }
                      placeholder="Ej. 1.200.000,50"
                      className={`${INPUT} text-right tabular-nums`}
                    />
                  </div>
                </div>
                <p className="text-xs text-vialto-steel">
                  El viaje queda a cargo del transportista elegido; chofer y vehículo no se guardan en el
                  viaje.
                </p>
              </div>
            }
            propioContent={
              <div className="grid gap-2">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={LABEL}>Chofer (flota propia)</span>
                    <select
                      value={draft.choferId}
                      onChange={(e) => set({ choferId: e.target.value })}
                      className={INPUT}
                    >
                      {choferesPropios.length === 0 && (
                        <option value="">Sin choferes de flota propia</option>
                      )}
                      {choferesPropios.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {ayudaFlota.chofer && (
                      <p className="text-xs text-amber-800/90">{ayudaFlota.chofer}</p>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={LABEL}>Vehículo (flota propia)</span>
                    <select
                      value={draft.vehiculoId}
                      onChange={(e) => set({ vehiculoId: e.target.value })}
                      className={INPUT}
                    >
                      <option value="">Elegí un vehículo…</option>
                      {vehiculosPropios.map((vh) => (
                        <option key={vh.id} value={vh.id}>{vh.patente}</option>
                      ))}
                    </select>
                    {ayudaFlota.vehiculo && (
                      <p className="text-xs text-amber-800/90">{ayudaFlota.vehiculo}</p>
                    )}
                  </div>
                </div>
                {inconsistenciaHint ? (
                  <p className="text-xs text-amber-800/90">{inconsistenciaHint}</p>
                ) : null}
                <p className="text-xs text-vialto-steel">
                  Solo choferes y vehículos con «Flota propia» en su ficha (sin transportista externo).
                </p>
              </div>
            }
          />

          {/* Patentes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Patente tractor</span>
              <input
                value={draft.patenteTractor}
                onChange={(e) => set({ patenteTractor: e.target.value })}
                placeholder="Ej. AA123BB"
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Patente semirremolque</span>
              <input
                value={draft.patenteSemirremolque}
                onChange={(e) => set({ patenteSemirremolque: e.target.value })}
                placeholder="Ej. AA456CC"
                className={INPUT}
              />
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Fecha de carga</span>
              <input
                type="datetime-local"
                value={draft.fechaCarga}
                onChange={(e) => set({ fechaCarga: e.target.value })}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={LABEL}>Fecha de descarga</span>
              <input
                type="datetime-local"
                value={draft.fechaDescarga}
                onChange={(e) => set({ fechaDescarga: e.target.value })}
                className={INPUT}
              />
            </div>
          </div>

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

          {/* Mercadería */}
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={LABEL}>Mercadería</span>
            <textarea
              value={draft.mercaderia}
              onChange={(e) => set({ mercaderia: e.target.value })}
              placeholder="Descripción de la carga"
              className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm"
            />
          </div>

          {/* Documentación */}
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={LABEL}>Documentación</span>
            <textarea
              value={draft.documentacionCsv}
              onChange={(e) => set({ documentacionCsv: e.target.value })}
              placeholder="URLs separadas por coma"
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
