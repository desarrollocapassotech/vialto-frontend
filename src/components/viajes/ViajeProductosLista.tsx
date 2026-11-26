import { useMemo, useState } from 'react';
import { ProductoSearchableSelect } from '@/components/viajes/ProductoSearchableSelect';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { PresentacionSearchableSelect } from '@/components/viajes/PresentacionSearchableSelect';
import { PresentacionFormModal } from '@/components/stock/PresentacionFormModal';
import { usePresentaciones } from '@/hooks/usePresentaciones';
import {
  formatPesoTnInput,
  opcionDesdeProducto,
  parseDecimalViaje,
  type OpcionProducto,
  type ViajeProductoItem,
} from '@/lib/productosViaje';
import type { Producto } from '@/types/api';
import { labelEnFrase } from '@/lib/productoLabel';
import { useProductoLabels } from '@/hooks/useProductoLabels';
import { conBordeError } from '@/lib/bordeError';
import { FaltaCampo } from '@/components/shared/FaltaCampo';

export type ViajeProductosListaProps = {
  groupId: string;
  value: ViajeProductoItem[];
  onChange: (items: ViajeProductoItem[]) => void;
  opciones: OpcionProducto[];
  triggerClassName: string;
  inputClassName?: string;
  disabled?: boolean;
  getToken?: () => Promise<string | null>;
  onProductoCreado?: (p: Producto) => void;
  /** Falta la carga: borde rojo en las filas sin elegir o, si no hay ninguna, en "+ Agregar". */
  error?: boolean;
  mostrarUnidad?: boolean;
  mostrarPeso?: boolean;
  tenantId?: string;
};

export function ViajeProductosLista({
  groupId,
  value,
  onChange,
  opciones,
  triggerClassName,
  disabled,
  getToken,
  onProductoCreado,
  error = false,
  mostrarUnidad = false,
  mostrarPeso = false,
  tenantId,
}: ViajeProductosListaProps) {
  const labels = useProductoLabels();
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevoParaIndex, setNuevoParaIndex] = useState<number | null>(null);
  const [showNuevaPres, setShowNuevaPres] = useState(false);
  const [nuevaPresParaIndex, setNuevaPresParaIndex] = useState<number | null>(null);
  const { presentaciones, agregarPresentacion } = usePresentaciones(tenantId, Boolean(mostrarUnidad));

  const [localOpciones, setLocalOpciones] = useState<OpcionProducto[]>([]);
  const todasLasOpciones = useMemo(() => {
    const ids = new Set(opciones.map((o) => o.id));
    return [...opciones, ...localOpciones.filter((o) => !ids.has(o.id))];
  }, [opciones, localOpciones]);

  const todasLasPresentaciones = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; activo?: boolean }>();
    for (const p of presentaciones) {
      map.set(p.id, p);
    }
    for (const item of value) {
      if (item.presentacionId && item.presentacion && !map.has(item.presentacionId)) {
        map.set(item.presentacionId, item.presentacion);
      }
    }
    return [...map.values()];
  }, [presentaciones, value]);

  function patchRow(i: number, patch: Partial<ViajeProductoItem>) {
    const next = [...value];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function removeRow(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  function addRow() {
    onChange([...value, { productoId: '', cantidad: 1 }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((item, i) => (
        <div key={`${groupId}-prod-${i}`} className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 basis-[14rem]">
            <ProductoSearchableSelect
              id={`${groupId}-prod-${i}`}
              value={item.productoId}
              onChange={(id) => patchRow(i, { productoId: id })}
              opciones={todasLasOpciones}
              triggerClassName={conBordeError(triggerClassName, error && !item.productoId.trim())}
              disabled={disabled}
              onNuevoProducto={getToken ? () => { setNuevoParaIndex(i); setShowNuevo(true); } : undefined}
            />
          </div>
          <label className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
              Cantidad
            </span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              disabled={disabled}
              placeholder="0"
              value={item.cantidad != null ? String(item.cantidad) : ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (!raw) {
                  patchRow(i, { cantidad: null });
                  return;
                }
                const n = Number(raw.replace(',', '.'));
                patchRow(i, { cantidad: Number.isFinite(n) ? n : null });
              }}
              className={`${triggerClassName} w-24 text-right tabular-nums`}
              aria-label={`Cantidad de ${labelEnFrase(labels.singular)} ${i + 1}`}
            />
          </label>
          {mostrarUnidad && (
            <div className="shrink-0 w-44">
              <PresentacionSearchableSelect
                id={`${groupId}-pres-${i}`}
                value={item.presentacionId ?? ''}
                onChange={(presId) => {
                  const pres = todasLasPresentaciones.find((p) => p.id === presId);
                  patchRow(i, {
                    presentacionId: presId || null,
                    presentacion: pres ? { id: pres.id, nombre: pres.nombre } : null,
                  });
                }}
                opciones={todasLasPresentaciones}
                triggerClassName={triggerClassName}
                disabled={disabled}
                onNuevaPresentacion={
                  getToken
                    ? () => {
                        setNuevaPresParaIndex(i);
                        setShowNuevaPres(true);
                      }
                    : undefined
                }
              />
            </div>
          )}
          {mostrarPeso && (
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Peso (tn)
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                disabled={disabled}
                placeholder="0"
                value={
                  item.pesoTnStr !== undefined
                    ? item.pesoTnStr
                    : item.pesoTn != null
                      ? formatPesoTnInput(item.pesoTn)
                      : ''
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  const trimmed = raw.trim();
                  if (!trimmed) {
                    patchRow(i, { pesoTnStr: '', pesoTn: null });
                    return;
                  }
                  if (!/^\d*([.,]\d*)?$/.test(trimmed)) return;
                  patchRow(i, {
                    pesoTnStr: raw,
                    pesoTn: parseDecimalViaje(trimmed),
                  });
                }}
                className={`${triggerClassName} w-24 text-right tabular-nums`}
                aria-label={`Peso en toneladas de ${labelEnFrase(labels.singular)} ${i + 1}`}
              />
            </label>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => removeRow(i)}
            className="h-9 shrink-0 px-2 text-xs uppercase tracking-wider text-vialto-steel border border-black/15 bg-white hover:bg-vialto-mist disabled:opacity-50"
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled || value.some((item) => !item.productoId.trim())}
        onClick={addRow}
        className={conBordeError(
          "h-9 w-fit px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50",
          error && value.length === 0,
        )}
      >
        + Agregar {labelEnFrase(labels.singular)}
      </button>
      <FaltaCampo show={error && !value.some((item) => item.productoId.trim())} />
      {showNuevo && getToken && (
        <ProductoModal
          labels={labels}
          modo="create"
          getToken={getToken}
          onClose={() => { setShowNuevo(false); setNuevoParaIndex(null); }}
          onSaved={(p) => {
            setLocalOpciones((prev) => [
              ...prev,
              opcionDesdeProducto(p),
            ]);
            onProductoCreado?.(p);
            if (nuevoParaIndex !== null) {
              patchRow(nuevoParaIndex, { productoId: p.id });
            } else {
              onChange([...value, { productoId: p.id, cantidad: 1 }]);
            }
            setShowNuevo(false);
            setNuevoParaIndex(null);
          }}
        />
      )}
      {showNuevaPres && getToken && (
        <PresentacionFormModal
          modo="create"
          titulo="Nueva unidad"
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => {
            setShowNuevaPres(false);
            setNuevaPresParaIndex(null);
          }}
          onSaved={(pres) => {
            agregarPresentacion(pres);
            if (nuevaPresParaIndex !== null) {
              patchRow(nuevaPresParaIndex, {
                presentacionId: pres.id,
                presentacion: { id: pres.id, nombre: pres.nombre },
              });
            }
            setShowNuevaPres(false);
            setNuevaPresParaIndex(null);
          }}
        />
      )}
    </div>
  );
}
