import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import {
  VIAJES_COLUMNAS,
  esOrdenEstandarColumnasViajes,
  normalizarOrdenColumnasViajes,
  type ViajeColumnaId,
} from "@/lib/viajesColumnasOrden";

/**
 * Modal para ordenar las columnas de la grilla de Viajes (`Tenant.viajesColumnasOrden`).
 * Lo usan el superadmin ("Configuración por empresa" → Viajes) y el admin de la
 * empresa (ícono junto a "Acciones" en la grilla); cada uno pasa su `guardar`.
 * El orden se acomoda acá y se guarda todo junto con "Guardar".
 */
export function ViajesColumnasOrdenModal({
  ordenInicial,
  habilitadas,
  errorCarga,
  labels,
  guardar,
  onClose,
}: {
  ordenInicial: readonly string[] | undefined;
  /** Columnas que la empresa ve (`columnasViajesHabilitadas`). null = cargando. */
  habilitadas: Set<ViajeColumnaId> | null;
  errorCarga?: string | null;
  /** Labels propios de la empresa (ej. ID propio 1 = "CTG", productos = "Granos"). */
  labels?: Partial<Record<ViajeColumnaId, string>>;
  /** Persiste el orden ([] = estándar). Si tira, el modal muestra el error y queda abierto. */
  guardar: (viajesColumnasOrden: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [orden, setOrden] = useState<ViajeColumnaId[]>(() =>
    normalizarOrdenColumnasViajes(ordenInicial),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Animación al reordenar (FLIP): se guarda dónde estaba cada fila antes del
  // cambio y, ya renderizado el orden nuevo, cada una se desliza desde ahí.
  const filasRef = useRef(new Map<ViajeColumnaId, HTMLLIElement>());
  const posicionesPrevias = useRef<Map<ViajeColumnaId, number> | null>(null);
  const [recienMovida, setRecienMovida] = useState<ViajeColumnaId | null>(null);

  function reordenar(next: ViajeColumnaId[], movida: ViajeColumnaId | null) {
    const posiciones = new Map<ViajeColumnaId, number>();
    filasRef.current.forEach((el, id) => posiciones.set(id, el.getBoundingClientRect().top));
    posicionesPrevias.current = posiciones;
    setRecienMovida(movida);
    setOrden(next);
  }

  useLayoutEffect(() => {
    const previas = posicionesPrevias.current;
    posicionesPrevias.current = null;
    if (!previas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    filasRef.current.forEach((el, id) => {
      const antes = previas.get(id);
      if (antes == null) return;
      const delta = antes - el.getBoundingClientRect().top;
      if (!delta) return;
      el.animate(
        [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
        { duration: 220, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    });
  }, [orden]);

  // El resaltado de la fila movida se apaga solo.
  useEffect(() => {
    if (!recienMovida) return;
    const t = window.setTimeout(() => setRecienMovida(null), 700);
    return () => window.clearTimeout(t);
  }, [recienMovida, orden]);

  /** Intercambia una columna con la columna habilitada vecina. */
  function mover(index: number, delta: -1 | 1) {
    const vecina = visibles[index + delta];
    if (!vecina) return;
    const a = orden.indexOf(visibles[index]);
    const b = orden.indexOf(vecina);
    const next = [...orden];
    [next[a], next[b]] = [next[b], next[a]];
    reordenar(next, visibles[index]);
  }

  async function onGuardar() {
    setSaving(true);
    setError(null);
    try {
      // El orden estándar se guarda como [] para que una columna nueva caiga en su lugar.
      await guardar(esOrdenEstandarColumnasViajes(orden) ? [] : orden);
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
        className="w-full max-w-md rounded border border-black/10 bg-white text-left normal-case tracking-normal shadow-lg"
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
            El orden aplica a todos los usuarios de la empresa. La selección en
            lote va siempre primera y Acciones siempre última.
          </p>
          {!habilitadas && !errorCarga && (
            <p className="py-6 text-center text-sm text-vialto-steel">Cargando…</p>
          )}
          {habilitadas && (
            <ol className="divide-y divide-black/10 border border-black/15">
              {visibles.map((id, i) => (
                <li
                  key={id}
                  ref={(el) => {
                    if (el) filasRef.current.set(id, el);
                    else filasRef.current.delete(id);
                  }}
                  className={`relative flex items-center gap-2 px-3 py-1.5 transition-colors duration-500 ${
                    recienMovida === id ? "z-10 bg-vialto-mist" : "bg-white"
                  }`}
                >
                  <span className="w-5 text-xs tabular-nums text-vialto-steel">{i + 1}.</span>
                  <span className="flex-1 truncate text-sm text-vialto-charcoal">{labelDe(id)}</span>
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
              onClick={() => reordenar(normalizarOrdenColumnasViajes([]), null)}
              className="mt-2 text-xs text-vialto-steel underline-offset-2 hover:underline disabled:opacity-50"
            >
              Restablecer orden estándar
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/10 px-5 py-3">
          <ErrorPieModal error={error ?? errorCarga ?? null} />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="border border-black/20 bg-white px-4 py-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void onGuardar()}
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
