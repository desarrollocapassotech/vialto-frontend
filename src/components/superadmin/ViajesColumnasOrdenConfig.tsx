import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import {
  VIAJES_COLUMNAS,
  columnasViajesHabilitadas,
  esOrdenEstandarColumnasViajes,
  normalizarOrdenColumnasViajes,
  type ViajeColumnaId,
} from "@/lib/viajesColumnasOrden";
import type { Tenant } from "@/types/api";

/** Mismo orden de precedencia que `useFieldConfig("viajes").isVisible`. */
const FORMULARIOS_VIAJES = ["alta_viaje", "edicion_viaje", "detalle_viaje"] as const;

type Props = {
  tenantId: string;
  ordenInicial: readonly string[] | undefined;
  /** Flags actuales de la empresa que definen qué columnas ve (IDs, tipo de flota). */
  tenant: Pick<
    Tenant,
    "idSistemaHabilitado" | "idPropio1Habilitado" | "idPropio2Habilitado" | "tipoFlota"
  >;
  /** Labels propios de la empresa (ej. ID propio 1 = "CTG"). */
  labels?: Partial<Record<ViajeColumnaId, string>>;
  /** Para que el host actualice su copia del tenant (si no, al reabrir vuelve al orden viejo). */
  onGuardado?: (viajesColumnasOrden: string[]) => void;
};

/**
 * Botón "Ordenar columnas" + modal para editar el orden de la grilla de Viajes
 * (`Tenant.viajesColumnasOrden`). El orden se acomoda en el modal y se guarda
 * todo junto con "Guardar".
 */
export function ViajesColumnasOrdenConfig(props: Props) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex shrink-0 items-center gap-2 border border-black/20 bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
      >
        <Columns3 className="h-3.5 w-3.5" aria-hidden />
        Ordenar columnas
      </button>
      {abierto && (
        <ViajesColumnasOrdenModal {...props} onClose={() => setAbierto(false)} />
      )}
    </>
  );
}

function ViajesColumnasOrdenModal({
  tenantId,
  ordenInicial,
  tenant,
  labels,
  onGuardado,
  onClose,
}: Props & { onClose: () => void }) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [orden, setOrden] = useState<ViajeColumnaId[]>(() =>
    normalizarOrdenColumnasViajes(ordenInicial),
  );
  const [habilitadas, setHabilitadas] = useState<Set<ViajeColumnaId> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chofer y Etapa dependen de la config de campos de Viajes de la empresa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const configs = await Promise.all(
          FORMULARIOS_VIAJES.map((formulario) =>
            apiJson<{ campo: string; visible: boolean }[]>(
              `/api/platform/field-config/${encodeURIComponent(tenantId)}?modulo=viajes&formulario=${formulario}`,
              () => getToken(),
            ),
          ),
        );
        const campoVisible = (campo: string) => {
          for (const config of configs) {
            const c = config.find((x) => x.campo === campo);
            if (c) return c.visible;
          }
          return true;
        };
        if (!cancelled) setHabilitadas(columnasViajesHabilitadas(tenant, campoVisible));
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, "camposEmpresa"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId, tenant, getToken]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  // Solo se listan las columnas habilitadas; las ocultas no se mueven de su
  // posición en `orden`, así recuperan su lugar si se vuelven a habilitar.
  const visibles = habilitadas ? orden.filter((id) => habilitadas.has(id)) : [];

  /** Intercambia una columna con la columna habilitada vecina. */
  function mover(index: number, delta: -1 | 1) {
    const vecina = visibles[index + delta];
    if (!vecina) return;
    const a = orden.indexOf(visibles[index]);
    const b = orden.indexOf(vecina);
    const next = [...orden];
    [next[a], next[b]] = [next[b], next[a]];
    setOrden(next);
  }

  async function guardar() {
    // El orden estándar se guarda como [] para que una columna nueva caiga en su lugar.
    const viajesColumnasOrden = esOrdenEstandarColumnasViajes(orden) ? [] : orden;
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/api/tenants/${encodeURIComponent(tenantId)}`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ viajesColumnasOrden }),
      });
      onGuardado?.(viajesColumnasOrden);
      showToast("Orden de columnas actualizado", "success");
      onClose();
    } catch (e) {
      setError(friendlyError(e, "camposEmpresa"));
    } finally {
      setSaving(false);
    }
  }

  const labelDe = (id: ViajeColumnaId) =>
    labels?.[id]?.trim() || VIAJES_COLUMNAS.find((c) => c.id === id)?.label || id;
  const sinCambios =
    orden.join("|") === normalizarOrdenColumnasViajes(ordenInicial).join("|");
  const botonClass =
    "inline-flex h-7 w-7 items-center justify-center border border-black/15 bg-white text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal disabled:opacity-30 disabled:pointer-events-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="viajes-columnas-orden-titulo"
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
          <h2
            id="viajes-columnas-orden-titulo"
            className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.12em] text-vialto-charcoal"
          >
            Orden de columnas — Viajes
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-xl leading-none text-vialto-steel hover:text-vialto-charcoal"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-vialto-steel">
            Solo se listan las columnas habilitadas para esta empresa. La
            selección en lote va siempre primera y Acciones siempre última.
          </p>
          {!habilitadas && !error && (
            <p className="py-6 text-center text-sm text-vialto-steel">Cargando…</p>
          )}
          {habilitadas && (
          <ol className="divide-y divide-black/10 border border-black/15">
            {visibles.map((id, i) => (
              <li key={id} className="flex items-center gap-2 px-3 py-1.5">
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
                  disabled={saving || i === visibles.length - 1}
                  onClick={() => mover(i, 1)}
                  aria-label={`Bajar ${labelDe(id)}`}
                  title="Bajar"
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ol>
          )}
          {habilitadas && !esOrdenEstandarColumnasViajes(orden) && (
            <button
              type="button"
              disabled={saving}
              onClick={() => setOrden(normalizarOrdenColumnasViajes([]))}
              className="mt-2 text-xs text-vialto-steel underline-offset-2 hover:underline disabled:opacity-50"
            >
              Restablecer orden estándar
            </button>
          )}
          <div className="mt-3">
            <CrudFormErrorAlert message={error} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="border border-black/20 bg-white px-4 py-2 text-xs uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving || sinCambios || !habilitadas}
            className="bg-vialto-charcoal px-4 py-2 text-xs uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
