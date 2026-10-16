import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import {
  VIAJES_COLUMNAS,
  esOrdenEstandarColumnasViajes,
  normalizarOrdenColumnasViajes,
  type ViajeColumnaId,
} from "@/lib/viajesColumnasOrden";

/**
 * Orden de columnas de la grilla de Viajes (`Tenant.viajesColumnasOrden`).
 * Guarda en cada movimiento, igual que el resto de "Configuración por empresa".
 */
export function ViajesColumnasOrdenConfig({
  tenantId,
  ordenInicial,
  labels,
  onGuardado,
}: {
  tenantId: string;
  ordenInicial: readonly string[] | undefined;
  /** Labels propios de la empresa (ej. ID propio 1 = "CTG"). */
  labels?: Partial<Record<ViajeColumnaId, string>>;
  /** Para que el host actualice su copia del tenant (si no, al remontar vuelve al orden viejo). */
  onGuardado?: (viajesColumnasOrden: string[]) => void;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [orden, setOrden] = useState<ViajeColumnaId[]>(() =>
    normalizarOrdenColumnasViajes(ordenInicial),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOrden(normalizarOrdenColumnasViajes(ordenInicial));
  }, [tenantId, ordenInicial]);

  async function persistir(next: ViajeColumnaId[]) {
    const anterior = orden;
    setOrden(next);
    setSaving(true);
    // El orden estándar se guarda como [] para que una columna nueva caiga en su lugar.
    const viajesColumnasOrden = esOrdenEstandarColumnasViajes(next) ? [] : next;
    try {
      await apiJson(`/api/tenants/${encodeURIComponent(tenantId)}`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ viajesColumnasOrden }),
      });
      onGuardado?.(viajesColumnasOrden);
      showToast("Orden de columnas actualizado", "success");
    } catch (e) {
      setOrden(anterior);
      showToast(friendlyError(e, "camposEmpresa"), "error");
    } finally {
      setSaving(false);
    }
  }

  function mover(index: number, delta: -1 | 1) {
    const destino = index + delta;
    if (destino < 0 || destino >= orden.length) return;
    const next = [...orden];
    [next[index], next[destino]] = [next[destino], next[index]];
    void persistir(next);
  }

  const labelDe = (id: ViajeColumnaId) =>
    labels?.[id]?.trim() || VIAJES_COLUMNAS.find((c) => c.id === id)?.label || id;
  const esEstandar = esOrdenEstandarColumnasViajes(orden);
  const botonClass =
    "inline-flex h-7 w-7 items-center justify-center border border-black/15 bg-white text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="ml-auto flex max-w-xs flex-col gap-2">
      <ol className="divide-y divide-black/10 border border-black/15 text-left">
        {orden.map((id, i) => (
          <li key={id} className="flex items-center gap-2 px-2 py-1">
            <span className="w-5 text-xs tabular-nums text-vialto-steel">{i + 1}.</span>
            <span className="flex-1 truncate text-sm">{labelDe(id)}</span>
            <button
              type="button"
              className={botonClass}
              disabled={saving || i === 0}
              onClick={() => mover(i, -1)}
              aria-label={`Subir ${labelDe(id)}`}
              title="Subir"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              className={botonClass}
              disabled={saving || i === orden.length - 1}
              onClick={() => mover(i, 1)}
              aria-label={`Bajar ${labelDe(id)}`}
              title="Bajar"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      {!esEstandar && (
        <button
          type="button"
          disabled={saving}
          onClick={() => void persistir(normalizarOrdenColumnasViajes([]))}
          className="self-end text-xs text-vialto-steel underline-offset-2 hover:underline disabled:opacity-50"
        >
          Restablecer orden estándar
        </button>
      )}
    </div>
  );
}
