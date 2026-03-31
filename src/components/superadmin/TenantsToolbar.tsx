interface TenantsToolbarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
}

export function TenantsToolbar({
  searchInput,
  onSearchInputChange,
  onSearch,
  onClear,
}: TenantsToolbarProps) {
  return (
    <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
      <label className="flex-1">
        <span className="sr-only">Buscar empresa</span>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch();
          }}
          placeholder="Buscar por empresa, CUIT u orgId"
          className="w-full h-10 rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal placeholder:text-vialto-steel/70 focus:outline-none focus:ring-2 focus:ring-vialto-bright/40"
        />
      </label>
      <button
        type="button"
        onClick={onSearch}
        className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite transition-colors"
      >
        Buscar
      </button>
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
