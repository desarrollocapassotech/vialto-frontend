import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import type { Pais } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

function filtrarPaises(paises: Pais[], query: string): Pais[] {
  const q = query.trim().toLowerCase();
  if (!q) return paises;
  return paises.filter((p) => p.nombre.toLowerCase().includes(q));
}

export function PaisSearchSelect({
  paises,
  value,
  onChange,
  disabled,
  loading = false,
  className,
  inputClassName = INPUT,
  placeholderCerrado = 'Elegí un país…',
  id,
  'aria-label': ariaLabel = 'País',
  onNuevo,
}: {
  paises: Pais[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  inputClassName?: string;
  placeholderCerrado?: string;
  id?: string;
  'aria-label'?: string;
  onNuevo?: () => void;
}) {
  return (
    <SearchableEntitySelect<Pais>
      items={paises}
      value={value}
      onChange={onChange}
      disabled={disabled}
      loading={loading}
      className={className}
      inputClassName={inputClassName}
      filterItems={filtrarPaises}
      getItemId={(p) => p.codigo || p.id}
      getPrimaryLabel={(p) => p.nombre}
      placeholderCerrado={placeholderCerrado}
      placeholderBuscar="Buscar país…"
      searchAriaLabel="Filtrar países"
      noItemsSlot={
        !onNuevo ? (
          <div className={`${inputClassName} flex items-center text-vialto-steel`} aria-label={ariaLabel}>
            Sin países cargados
          </div>
        ) : undefined
      }
      id={id}
      aria-label={ariaLabel}
      onNuevo={onNuevo}
      onNuevoLabel="+ Nuevo país"
    />
  );
}