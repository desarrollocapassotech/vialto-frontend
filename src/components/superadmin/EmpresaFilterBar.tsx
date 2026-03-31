import { useEffect, useMemo, useState } from 'react';
import type { Tenant } from '@/types/api';

type EmpresaFilterBarProps = {
  tenants: Tenant[] | null;
  /** `clerkOrgId` elegido; cadena vacía = todavía no hay empresa (placeholder). */
  value: string;
  onChange: (clerkOrgId: string) => void;
  className?: string;
};

const MIN_SEARCH_CHARS = 3;

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function EmpresaFilterBar({
  tenants,
  value,
  onChange,
  className = '',
}: EmpresaFilterBarProps) {
  const [query, setQuery] = useState('');
  const sorted = useMemo(
    () => [...(tenants ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [tenants],
  );
  const selected = sorted.find((t) => t.clerkOrgId === value) ?? null;
  const normalizedQuery = normalizeSearch(query);
  const hasMinChars = normalizedQuery.length >= MIN_SEARCH_CHARS;
  const matches = useMemo(() => {
    if (!hasMinChars) return [];
    return sorted.filter((tenant) =>
      normalizeSearch(tenant.name).includes(normalizedQuery),
    );
  }, [hasMinChars, normalizedQuery, sorted]);

  useEffect(() => {
    setQuery(selected?.name ?? '');
  }, [selected?.name]);

  function handleQueryChange(nextValue: string) {
    setQuery(nextValue);
    if (value) {
      onChange('');
    }
  }

  function handleSelectTenant(tenant: Tenant) {
    onChange(tenant.clerkOrgId);
    setQuery(tenant.name);
  }

  function handleEnterSelection() {
    if (!hasMinChars || matches.length === 0) return;
    const exactMatch =
      matches.find((tenant) => normalizeSearch(tenant.name) === normalizedQuery) ??
      matches[0];
    handleSelectTenant(exactMatch);
  }

  return (
    <div className={`flex flex-col gap-1.5 min-w-[min(100%,280px)] max-w-md ${className}`}>
      <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
        Empresa
      </span>
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleEnterSelection();
          }
        }}
        placeholder="Ingresá al menos 3 letras para buscar empresa…"
        className="w-full border border-black/10 bg-white rounded px-3 py-2.5 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
      />
      {hasMinChars && (
        <div className="max-h-56 overflow-auto rounded border border-black/10 bg-white">
          {matches.length > 0 ? (
            <ul>
              {matches.map((tenant) => (
                <li key={tenant.clerkOrgId} className="border-b last:border-b-0 border-black/5">
                  <button
                    type="button"
                    onClick={() => handleSelectTenant(tenant)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-vialto-mist ${
                      value === tenant.clerkOrgId ? 'bg-vialto-mist font-medium' : ''
                    }`}
                  >
                    {tenant.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-vialto-steel">
              No se encontraron empresas.
            </p>
          )}
        </div>
      )}
      {!hasMinChars && (
        <p className="text-xs text-vialto-steel">
          Ingresá al menos {MIN_SEARCH_CHARS} letras para buscar.
        </p>
      )}
      {value && selected && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-vialto-steel">
            Seleccionada: <span className="font-medium text-vialto-charcoal">{selected.name}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="text-xs uppercase tracking-wider text-vialto-fire hover:text-vialto-bright"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
