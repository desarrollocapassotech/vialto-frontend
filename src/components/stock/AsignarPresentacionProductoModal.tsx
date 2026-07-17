import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { PresentacionFormModal } from "@/components/stock/PresentacionFormModal";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError, apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import type { Presentacion, Producto, ProductoPresentacion } from "@/types/api";

const INPUT = "h-9 w-full border border-black/15 bg-white px-2 text-sm";
const LABEL =
  "text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel";

export function AsignarPresentacionProductoModal({
  producto,
  getToken,
  productosBase,
  tenantId,
  onClose,
  onSaved,
}: {
  producto: Producto;
  getToken: () => Promise<string | null>;
  productosBase: string;
  tenantId?: string;
  onClose: () => void;
  onSaved: (producto: Producto, nuevaPp: ProductoPresentacion) => void;
}) {
  const { showToast } = useToast();
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const presentacionesUrl = tenantId
    ? `/api/platform/stock/presentaciones?tenantId=${encodeURIComponent(tenantId)}&activo=1`
    : "/api/stock/presentaciones?activo=1";
  const presentacionesBase = tenantId
    ? "/api/platform/stock/presentaciones"
    : "/api/stock/presentaciones";

  const asignadasIds = useMemo(
    () => new Set(producto.productoPresentaciones.map((pp) => pp.presentacionId)),
    [producto.productoPresentaciones],
  );

  const [catalogo, setCatalogo] = useState<Presentacion[]>([]);
  const [catalogoLoading, setCatalogoLoading] = useState(true);
  const [presentacionId, setPresentacionId] = useState("");
  const [unidadesPorBulto, setUnidadesPorBulto] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [crearCatalogo, setCrearCatalogo] = useState(false);

  const disponibles = useMemo(
    () => catalogo.filter((p) => !asignadasIds.has(p.id)),
    [catalogo, asignadasIds],
  );

  const loadCatalogo = useCallback(async () => {
    setCatalogoLoading(true);
    try {
      const data = await apiJson<Presentacion[]>(presentacionesUrl, () =>
        getToken(),
      );
      setCatalogo(data.filter((p) => p.activo !== false));
    } catch {
      setCatalogo([]);
    } finally {
      setCatalogoLoading(false);
    }
  }, [presentacionesUrl, getToken]);

  useEffect(() => {
    void loadCatalogo();
  }, [loadCatalogo]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !crearCatalogo) onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, crearCatalogo]);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!presentacionId) errs.presentacionId = "Seleccioná una presentación.";
    const ub = parseInt(unidadesPorBulto, 10);
    if (!unidadesPorBulto.trim() || isNaN(ub) || ub < 1) {
      errs.unidadesPorBulto =
        "Las unidades por bulto deben ser un número entero mayor o igual a 1.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);

    try {
      const body = {
        nombre: producto.nombre,
        descripcion: producto.descripcion ?? undefined,
        pesoUnitarioKg: producto.pesoUnitarioKg,
        presentaciones: [
          ...producto.productoPresentaciones.map((pp) => ({
            id: pp.id,
            presentacionId: pp.presentacionId,
            unidadesPorBulto: pp.unidadesPorBulto,
          })),
          {
            presentacionId,
            unidadesPorBulto: ub,
          },
        ],
      };

      const result = await apiJson<Producto>(
        `${productosBase}/${encodeURIComponent(producto.id)}${qs}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify(body) },
      );

      const prevIds = new Set(producto.productoPresentaciones.map((pp) => pp.id));
      const nuevaPp =
        result.productoPresentaciones.find(
          (pp) => !prevIds.has(pp.id) && pp.presentacionId === presentacionId,
        ) ??
        result.productoPresentaciones.find(
          (pp) => pp.presentacionId === presentacionId,
        );

      if (!nuevaPp) {
        throw new Error("No se pudo identificar la presentación recién asignada.");
      }

      showToast("Presentación asignada al producto", "success");
      onSaved(result, nuevaPp);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? e.message
          : friendlyError(e, "stock"),
      );
      showToast("No se pudo asignar la presentación", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="asignar-pp-titulo"
          className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
            <div>
              <h2
                id="asignar-pp-titulo"
                className="font-[family-name:var(--font-display)] text-xl tracking-wide"
              >
                Nueva presentación
              </h2>
              <p className="mt-1 text-sm text-vialto-steel">
                Para{" "}
                <span className="font-medium text-vialto-charcoal">
                  {producto.nombre}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="space-y-1">
              <label className={LABEL}>
                Presentación <span className="text-red-500">*</span>
              </label>
              <SearchableEntitySelect<Presentacion>
                items={disponibles}
                value={presentacionId}
                onChange={setPresentacionId}
                loading={catalogoLoading}
                filterItems={(items, q) => {
                  const lq = q.toLowerCase();
                  return items.filter((p) => p.nombre.toLowerCase().includes(lq));
                }}
                getPrimaryLabel={(p) => p.nombre}
                placeholderCerrado="Elegí una presentación…"
                placeholderBuscar="Buscar presentación…"
                inputClassName={`${INPUT} ${fieldErrors.presentacionId ? "border-red-400" : ""}`}
                onNuevo={() => setCrearCatalogo(true)}
                onNuevoLabel="+ Crear presentación"
                noItemsSlot={
                  <p className="px-3 py-2 text-sm text-vialto-steel">
                    No hay presentaciones disponibles. Creá una nueva.
                  </p>
                }
              />
              <CrudFieldError message={fieldErrors.presentacionId} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>
                Unidades por bulto <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={unidadesPorBulto}
                onChange={(e) => setUnidadesPorBulto(e.target.value)}
                placeholder="Ej. 12"
                className={`${INPUT} ${fieldErrors.unidadesPorBulto ? "border-red-400" : ""}`}
              />
              <CrudFieldError message={fieldErrors.unidadesPorBulto} />
            </div>

            {error && (
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? "Guardando…" : "Guardar y usar"}
            </button>
          </div>
        </div>
      </div>

      {crearCatalogo && (
        <PresentacionFormModal
          modo="create"
          getToken={getToken}
          baseUrl={presentacionesBase}
          tenantId={tenantId}
          onClose={() => setCrearCatalogo(false)}
          onSaved={(p) => {
            setCatalogo((prev) =>
              [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre)),
            );
            setPresentacionId(p.id);
            setCrearCatalogo(false);
          }}
        />
      )}
    </>
  );
}
