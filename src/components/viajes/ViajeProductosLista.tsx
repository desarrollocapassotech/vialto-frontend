import { ProductoSearchableSelect } from '@/components/viajes/ProductoSearchableSelect';
import type { OpcionProducto, ViajeProductoItem } from '@/lib/productosViaje';

export type ViajeProductosListaProps = {
  groupId: string;
  value: ViajeProductoItem[];
  onChange: (items: ViajeProductoItem[]) => void;
  opciones: OpcionProducto[];
  triggerClassName: string;
  inputClassName: string;
  disabled?: boolean;
};

export function ViajeProductosLista({
  groupId,
  value,
  onChange,
  opciones,
  triggerClassName,
  inputClassName,
  disabled,
}: ViajeProductosListaProps) {
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
              opciones={opciones}
              triggerClassName={triggerClassName}
              disabled={disabled}
            />
          </div>
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Cant."
            value={item.cantidad ?? ''}
            onChange={(e) =>
              patchRow(i, { cantidad: e.target.value !== '' ? Number(e.target.value) : null })
            }
            disabled={disabled}
            className={`h-9 w-24 shrink-0 border border-black/15 px-2 text-sm ${inputClassName}`}
          />
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Peso kg"
            value={item.pesoKg ?? ''}
            onChange={(e) =>
              patchRow(i, { pesoKg: e.target.value !== '' ? Number(e.target.value) : null })
            }
            disabled={disabled}
            className={`h-9 w-28 shrink-0 border border-black/15 px-2 text-sm ${inputClassName}`}
          />
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
    </div>
  );
}
