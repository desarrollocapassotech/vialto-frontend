import { useState } from "react";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import type { Taller } from "@/types/mantenimiento";

function filtrarTalleres(talleres: Taller[], q: string): Taller[] {
  const s = q.trim().toLowerCase();
  if (!s) return talleres;
  return talleres.filter((t) => t.nombre.toLowerCase().includes(s) || (t.cuit ?? "").includes(s));
}

/**
 * Taller de la OT, con alta rápida ("+ Nuevo taller" → solo nombre). El taller creado queda
 * elegido y se avisa al padre para que lo sume a su lista.
 */
export function TallerSelect({
  talleres,
  value,
  onChange,
  onCreado,
  getToken,
  tenantId,
  inputClassName,
}: {
  talleres: Taller[];
  value: string;
  onChange: (id: string) => void;
  onCreado: (taller: Taller) => void;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  inputClassName?: string;
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crear() {
    if (!nombre.trim()) {
      setError("Ingresá el nombre del taller.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const t = await apiJson<Taller>(mantUrl("talleres", tenantId), () => getToken(), {
        method: "POST",
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      onCreado(t);
      onChange(t.id);
      setCreando(false);
      setNombre("");
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div className="grid gap-1">
        <div className="flex gap-2">
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void crear();
              }
            }}
            placeholder="Nombre del taller nuevo"
            aria-label="Nombre del taller nuevo"
            className={`h-10 min-w-0 flex-1 border bg-white px-3 text-sm ${error ? "border-red-400" : "border-black/15"}`}
          />
          <button
            type="button"
            disabled={guardando}
            onClick={() => void crear()}
            className="inline-flex h-10 items-center gap-1.5 bg-vialto-charcoal px-3 text-xs uppercase tracking-wider text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {guardando && <Spinner className="h-3.5 w-3.5" />}
            Crear
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => {
              setCreando(false);
              setError(null);
            }}
            className="h-10 border border-black/20 px-3 text-xs uppercase tracking-wider hover:bg-vialto-mist"
          >
            Cancelar
          </button>
        </div>
        {error && <span className="text-xs font-medium text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <SearchableEntitySelect<Taller>
      items={talleres.filter((t) => t.activo || t.id === value)}
      value={value}
      onChange={onChange}
      filterItems={filtrarTalleres}
      getPrimaryLabel={(t) => t.nombre}
      getSecondaryLabel={(t) => t.telefono}
      placeholderCerrado="Sin taller"
      placeholderBuscar="Buscar taller…"
      searchAriaLabel="Filtrar talleres"
      allowEmptyValue
      emptyListChoiceLabel="Sin taller"
      aria-label="Taller"
      onNuevo={() => setCreando(true)}
      onNuevoLabel="+ Nuevo taller"
      inputClassName={inputClassName}
    />
  );
}
