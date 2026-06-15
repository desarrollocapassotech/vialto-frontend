import { useMemo, useState } from 'react';
import { ProductoSearchableSelect } from '@/components/viajes/ProductoSearchableSelect';
import { ProductoModal } from '@/components/stock/ProductoModal';
import type { OpcionProducto, ViajeProductoItem } from '@/lib/productosViaje';
import type { Producto } from '@/types/api';

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
}: ViajeProductosListaProps) {
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevoParaIndex, setNuevoParaIndex] = useState<number | null>(null);
  const [localOpciones, setLocalOpciones] = useState<OpcionProducto[]>([]);
  const todasLasOpciones = useMemo(() => {
    const ids = new Set(opciones.map((o) => o.id));
    return [...opciones, ...localOpciones.filter((o) => !ids.has(o.id))];
  }, [opciones, localOpciones]);
  function patchRow(i: number, patch: Partial<ViajeProductoItem>) {
    const next = [...value];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function removeRow(i: number) {
    onChange(value.filter((_, j) => j !== i));
  }

  function addRow() {
    onChange([...value, { productoId: '' }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-xs text-vialto-steel">Sin productos indicados (opcional).</p>
      ) : null}
      {value.map((item, i) => (
        <div key={`${groupId}-prod-${i}`} className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 basis-[14rem]">
            <ProductoSearchableSelect
              id={`${groupId}-prod-${i}`}
              value={item.productoId}
              onChange={(id) => patchRow(i, { productoId: id })}
              opciones={todasLasOpciones}
              triggerClassName={triggerClassName}
              disabled={disabled}
              onNuevoProducto={getToken ? () => { setNuevoParaIndex(i); setShowNuevo(true); } : undefined}
            />
          </div>
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
        disabled={disabled}
        onClick={addRow}
        className="h-9 w-fit px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
      >
        + Agregar producto
      </button>
      {showNuevo && getToken && (
        <ProductoModal
          modo="create"
          getToken={getToken}
          onClose={() => { setShowNuevo(false); setNuevoParaIndex(null); }}
          onSaved={(p) => {
            setLocalOpciones((prev) => [
              ...prev,
              { id: p.id, nombre: p.nombre, activo: p.activo },
            ]);
            onProductoCreado?.(p);
            if (nuevoParaIndex !== null) {
              patchRow(nuevoParaIndex, { productoId: p.id });
            } else {
              onChange([...value, { productoId: p.id }]);
            }
            setShowNuevo(false);
            setNuevoParaIndex(null);
          }}
        />
      )}
    </div>
  );
}
