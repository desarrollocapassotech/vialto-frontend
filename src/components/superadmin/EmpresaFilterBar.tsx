import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import type { Tenant } from "@/types/api";

type EmpresaFilterBarProps = {
  tenants: Tenant[] | null;
  /** `clerkOrgId` elegido; cadena vacía = todavía no hay empresa (placeholder). */
  value: string;
  onChange: (clerkOrgId: string) => void;
  className?: string;
};

/**
 * Selector de empresa de las pantallas de superadmin. Sin empresa elegida muestra la
 * lista completa (A→Z) para elegir con un click; escribir la filtra.
 */
function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function EmpresaFilterBar({
  tenants,
  value,
  onChange,
  className = "",
}: EmpresaFilterBarProps) {
  const [query, setQuery] = useState("");
  const sorted = useMemo(
    () =>
      [...(tenants ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [tenants],
  );
  const selected = sorted.find((t) => t.clerkOrgId === value) ?? null;
  const normalizedQuery = normalizeSearch(query);
  const matches = useMemo(
    () =>
      normalizedQuery
        ? sorted.filter((tenant) =>
            normalizeSearch(tenant.name).includes(normalizedQuery),
          )
        : sorted,
    [normalizedQuery, sorted],
  );

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  function handleQueryChange(nextValue: string) {
    setQuery(nextValue);
    if (value) {
      onChange("");
    }
  }

  function handleSelectTenant(tenant: Tenant) {
    onChange(tenant.clerkOrgId);
    setQuery(tenant.name);
  }

  function handleEnterSelection() {
    if (!normalizedQuery || matches.length === 0) return;
    const exactMatch =
      matches.find(
        (tenant) => normalizeSearch(tenant.name) === normalizedQuery,
      ) ?? matches[0];
    handleSelectTenant(exactMatch);
  }

  const buscador = (
    <label className="relative block w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vialto-steel"
        aria-hidden
      />
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleEnterSelection();
          }
        }}
        placeholder="Buscar empresa…"
        aria-label="Buscar empresa"
        className="h-10 w-full rounded border border-black/10 bg-white pl-9 pr-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35"
      />
    </label>
  );

  // Con empresa elegida: campo compacto con su nombre + "Cambiar".
  if (value && selected) {
    return (
      <div className={`flex max-w-md flex-col gap-1.5 ${className}`}>
        <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
          Empresa
        </span>
        <div className="flex items-center gap-3 rounded border border-black/10 bg-white py-1.5 pl-1.5 pr-3">
          <Iniciales nombre={selected.name} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-vialto-charcoal">
            {selected.name}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
            className="shrink-0 text-xs uppercase tracking-wider text-vialto-fire hover:text-vialto-bright"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  // Sin empresa elegida: todas las empresas en tarjetas, a todo el ancho.
  return (
    <section className={`w-full ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-charcoal">
          Elegí una empresa
        </h2>
        {buscador}
      </div>

      {tenants === null ? (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          aria-hidden
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[68px] animate-pulse rounded bg-black/[0.06]"
            />
          ))}
        </div>
      ) : matches.length === 0 ? (
        <p className="mt-6 text-sm text-vialto-steel">
          No hay empresas que coincidan con “{query.trim()}”.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {matches.map((tenant) => (
            <li key={tenant.clerkOrgId}>
              <button
                type="button"
                onClick={() => handleSelectTenant(tenant)}
                className="group flex w-full items-center gap-3 rounded border border-black/10 bg-white p-3 text-left transition-colors hover:border-vialto-fire/60 hover:shadow-sm"
              >
                <Iniciales nombre={tenant.name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-vialto-charcoal">
                    {tenant.name}
                  </span>
                  <span className="block text-xs text-vialto-steel">
                    Alta {fmtDateUtc(tenant.createdAt)}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-vialto-steel/50 transition-colors group-hover:text-vialto-fire"
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Iniciales({ nombre }: { nombre: string }) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  const iniciales =
    palabras.length >= 2
      ? `${palabras[0][0]}${palabras[1][0]}`
      : (palabras[0]?.slice(0, 2) ?? "?");
  return (
    <span
      aria-hidden
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-vialto-mist font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-wider text-vialto-charcoal"
    >
      {iniciales}
    </span>
  );
}
