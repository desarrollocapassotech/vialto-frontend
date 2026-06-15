interface FiltroSelect {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  opciones: { value: string; label: string }[];
}

interface ListadoToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filtros?: FiltroSelect[];
  onClear: () => void;
}

export function ListadoToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  filtros = [],
  onClear,
}: ListadoToolbarProps) {
  return (
    <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
      <label className="flex-1">
        <span className="sr-only">{searchPlaceholder}</span>
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal placeholder:text-vialto-steel/70 focus:outline-none focus:ring-2 focus:ring-vialto-bright/40"
        />
      </label>
      {filtros.map((f, i) => (
        <select
          key={i}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="h-10 rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-bright/40"
        >
          <option value="">{f.placeholder}</option>
          {f.opciones.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="h-10 px-4 border border-black/15 bg-white text-vialto-charcoal text-sm uppercase tracking-wider hover:bg-vialto-mist transition-colors"
      >
        Limpiar
      </button>
    </div>
  );
}