import { useMemo, useState } from 'react';
import { VehiculoPatenteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { VehiculoModal } from '@/components/viajes/VehiculoModal';
import { VEHICULO_TIPO_VALORES, labelTipoVehiculo, vehiculosPorTipo } from '@/lib/vehiculoTipos';
import type { Vehiculo } from '@/types/api';

export type ViajeVehiculoRowDraft = { tipo: string; vehiculoId: string };

const LABEL =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';
const INPUT = 'h-9 border border-black/15 bg-white px-2 text-sm';

type Props = {
  rows: ViajeVehiculoRowDraft[];
  onChange: (rows: ViajeVehiculoRowDraft[]) => void;
  vehiculos: Vehiculo[];
  /** Ruta absoluta p. ej. `/vehiculos/nuevo` */
  crearVehiculoHref: string;
  /** Para agrupar radios / ids accesibles */
  groupId: string;
  /** Recargar maestro de vehículos sin refrescar la página (p. ej. tras crear un vehículo en otra pestaña). */
  onRefreshVehiculos?: () => void;
  refreshingVehiculos?: boolean;
  /** Cuando se provee, habilita la creación rápida de vehículos desde el selector de patente. */
  getToken?: () => Promise<string | null>;
  tenantId?: string;
  /** Callback cuando se crea un vehículo nuevo (para que el padre refresque su maestro). */
  onVehiculoCreado?: (v: Vehiculo) => void;
  /** Modal de creación rápida sobre ViajeEditModal (z-index superior). */
  quickCreateStacked?: boolean;
  /** Si es false, se pueden quitar todas las filas (vehículos opcionales, p. ej. transportista externo). */
  alMenosUno?: boolean;
  /** Etiqueta de la sección; por defecto según `alMenosUno`. */
  labelVehiculos?: string;
};

export function ViajeVehiculosLista({
  rows,
  onChange,
  vehiculos,
  crearVehiculoHref,
  groupId,
  onRefreshVehiculos,
  refreshingVehiculos,
  getToken,
  tenantId,
  onVehiculoCreado,
  quickCreateStacked,
  alMenosUno = true,
  labelVehiculos,
}: Props) {
  const titulo =
    labelVehiculos ??
    (alMenosUno ? 'Vehículos del viaje (al menos uno)' : 'Vehículos del viaje (opcional)');
  const [showNuevoVehiculo, setShowNuevoVehiculo] = useState(false);
  const [nuevoParaRowIndex, setNuevoParaRowIndex] = useState<number | null>(null);
  const [localVehiculos, setLocalVehiculos] = useState<Vehiculo[]>([]);

  const todosLosVehiculos = useMemo(() => {
    const ids = new Set(vehiculos.map((v) => v.id));
    return [...vehiculos, ...localVehiculos.filter((v) => !ids.has(v.id))];
  }, [vehiculos, localVehiculos]);

  function setRow(i: number, patch: Partial<ViajeVehiculoRowDraft>) {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  }

  function addRow() {
    onChange([...rows, { tipo: 'tractor', vehiculoId: '' }]);
  }

  function removeRow(i: number) {
    if (alMenosUno && rows.length <= 1) return;
    onChange(rows.filter((_, j) => j !== i));
  }

  return (
    <>
    <div className="flex flex-col gap-3 md:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className={LABEL}>{titulo}</span>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onRefreshVehiculos && (
            <button
              type="button"
              onClick={onRefreshVehiculos}
              disabled={refreshingVehiculos}
              className="text-[11px] text-vialto-steel/85 hover:text-vialto-charcoal underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-45"
            >
              {refreshingVehiculos ? 'Actualizando…' : 'Actualizar listado'}
            </button>
          )}
          <button
            type="button"
            onClick={addRow}
            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
          >
            + Agregar vehículo
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          const candidatos = vehiculosPorTipo<Vehiculo>(todosLosVehiculos, row.tipo);
          const idsUsados = new Set(
            rows.map((r, j) => (j !== i && r.vehiculoId ? r.vehiculoId : null)).filter(Boolean) as string[],
          );
          const opciones = candidatos.filter((v) => !idsUsados.has(v.id) || v.id === row.vehiculoId);
          const sinOpciones = opciones.length === 0;
          return (
            <div
              key={`${groupId}-vh-${i}`}
              className="grid grid-cols-1 gap-2 rounded border border-black/10 bg-white/60 p-3 sm:grid-cols-[1fr_1fr_auto]"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>Tipo</span>
                <select
                  value={row.tipo}
                  onChange={(e) => {
                    const tipo = e.target.value;
                    setRow(i, { tipo, vehiculoId: '' });
                  }}
                  className={INPUT}
                  aria-label={`Tipo de vehículo ${i + 1}`}
                >
                  {VEHICULO_TIPO_VALORES.map((t) => (
                    <option key={t} value={t}>
                      {labelTipoVehiculo(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>Vehículo</span>
                <VehiculoPatenteSearchSelect
                  vehiculos={opciones}
                  value={row.vehiculoId}
                  onChange={(id) => setRow(i, { vehiculoId: id })}
                  sinOpciones={sinOpciones}
                  inputClassName={INPUT}
                  aria-label={`Vehículo ${i + 1}`}
                  onNuevo={getToken ? () => { setNuevoParaRowIndex(i); setShowNuevoVehiculo(true); } : undefined}
                />
                {sinOpciones && !getToken ? (
                  <p className="text-xs text-amber-800/90">
                    No hay vehículos de tipo «{labelTipoVehiculo(row.tipo)}»
                    {alMenosUno ? ' en flota propia' : ' en el maestro'}.{' '}
                    <a
                      href={crearVehiculoHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium text-vialto-charcoal"
                    >
                      Crear vehículo en una pestaña nueva
                    </a>
                    {' '}y recargá esta página.
                  </p>
                ) : null}
              </div>
              <div className="flex items-end justify-end sm:pb-0">
                <button
                  type="button"
                  disabled={alMenosUno && rows.length <= 1}
                  onClick={() => removeRow(i)}
                  className="text-xs uppercase tracking-wider px-2 py-1 border border-black/15 text-vialto-steel hover:bg-red-50 disabled:opacity-40"
                  title={
                    alMenosUno && rows.length <= 1
                      ? 'Debe haber al menos un vehículo'
                      : 'Quitar fila'
                  }
                >
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
    {showNuevoVehiculo && getToken && (
      <VehiculoModal
        getToken={getToken}
        tenantId={tenantId}
        stacked={quickCreateStacked}
        onClose={() => { setShowNuevoVehiculo(false); setNuevoParaRowIndex(null); }}
        onSaved={(v) => {
          setLocalVehiculos((prev) => [...prev, v]);
          onVehiculoCreado?.(v);
          if (nuevoParaRowIndex !== null) {
            setRow(nuevoParaRowIndex, { vehiculoId: v.id });
          }
          setShowNuevoVehiculo(false);
          setNuevoParaRowIndex(null);
        }}
      />
    )}
    </>
  );
}
