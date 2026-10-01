import { useMemo, useState } from 'react';
import { VehiculoPatenteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { VehiculoModal } from '@/components/viajes/VehiculoModal';
import type { Vehiculo } from '@/types/api';

/** `tipo` se deriva del vehículo elegido; no lo elige el usuario. */
export type ViajeVehiculoRowDraft = { tipo: string; vehiculoId: string };

function tipoDeVehiculo(vehiculos: Vehiculo[], id: string, fallback: string): string {
  return vehiculos.find((v) => v.id === id)?.tipo ?? fallback;
}

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
  getToken,
  tenantId,
  onVehiculoCreado,
  quickCreateStacked,
  alMenosUno = true,
  labelVehiculos,
}: Props) {
  const titulo =
    labelVehiculos ??
    (alMenosUno ? 'Vehículos del viaje (al menos uno)' : 'Vehículos del viaje');
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
        <button
          type="button"
          onClick={addRow}
          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
        >
          + Agregar vehículo
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map((row, i) => {
          // El tipo no se elige acá: es el del vehículo elegido (Vehiculo.tipo).
          const idsUsados = new Set(
            rows.map((r, j) => (j !== i && r.vehiculoId ? r.vehiculoId : null)).filter(Boolean) as string[],
          );
          const opciones = todosLosVehiculos.filter(
            (v) => !idsUsados.has(v.id) || v.id === row.vehiculoId,
          );
          const sinOpciones = opciones.length === 0;
          return (
            <div
              key={`${groupId}-vh-${i}`}
              className="grid grid-cols-1 gap-2 rounded border border-black/10 bg-white/60 p-3 sm:grid-cols-[1fr_auto]"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className={LABEL}>Vehículo</span>
                <VehiculoPatenteSearchSelect
                  vehiculos={opciones}
                  value={row.vehiculoId}
                  onChange={(id) =>
                    setRow(i, {
                      vehiculoId: id,
                      tipo: tipoDeVehiculo(todosLosVehiculos, id, row.tipo),
                    })
                  }
                  sinOpciones={sinOpciones}
                  inputClassName={INPUT}
                  aria-label={`Vehículo ${i + 1}`}
                  onNuevo={getToken ? () => { setNuevoParaRowIndex(i); setShowNuevoVehiculo(true); } : undefined}
                />
                {sinOpciones && !getToken ? (
                  <p className="text-xs text-amber-800/90">
                    No hay vehículos
                    {alMenosUno ? ' de flota propia' : ' cargados'}.{' '}
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
            setRow(nuevoParaRowIndex, { vehiculoId: v.id, tipo: v.tipo });
          }
          setShowNuevoVehiculo(false);
          setNuevoParaRowIndex(null);
        }}
      />
    )}
    </>
  );
}
