import { useAuth } from "@clerk/clerk-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  useMemo,
} from "react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from "@/lib/listadoTabla";
import type { Presentacion } from "@/types/api";

type FormState = { nombre: string; activo: boolean };

export function PresentacionesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Presentacion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ nombre: "", activo: true });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const editing = rows?.find((r) => r.id === editingId) ?? null;

  const load = useCallback(async () => {
    const data = await apiJson<Presentacion[]>(
      "/api/stock/presentaciones",
      () => getToken(),
    );
    setRows(data);
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, "stock"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    if (!isFormOpen) {
      setEditingId(null);
      return;
    }
    if (editing) {
      setForm({ nombre: editing.nombre, activo: editing.activo });
      return;
    }
    setForm({ nombre: "", activo: true });
  }, [editing, isFormOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !isSignedIn) return;
    if (!form.nombre.trim()) {
      setFieldErrors({ nombre: "Ingresá el nombre de la presentación." });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    try {
      const payload = { nombre: form.nombre.trim(), activo: form.activo };
      if (editingId) {
        await apiJson<Presentacion>(
          `/api/stock/presentaciones/${encodeURIComponent(editingId)}`,
          () => getToken(),
          { method: "PATCH", body: JSON.stringify(payload) },
        );
      } else {
        await apiJson<Presentacion>(
          "/api/stock/presentaciones",
          () => getToken(),
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
      }
      await load();
      setIsFormOpen(false);
      setEditingId(null);
    } catch (e) {
      setError(friendlyError(e, "stock"));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(row: Presentacion) {
    if (!window.confirm(`¿Eliminar la presentación "${row.nombre}"?`)) return;
    setError(null);
    try {
      await apiJson(
        `/api/stock/presentaciones/${encodeURIComponent(row.id)}`,
        () => getToken(),
        { method: "DELETE" },
      );
      await load();
    } catch (e) {
      setError(friendlyError(e, "stock"));
    }
  }

  const meta = useMemo(() => {
    if (!rows) return null;
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      total,
      page,
      pageSize,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    };
  }, [rows, page, pageSize]);

  const paginatedRows = useMemo(() => {
    if (!rows) return null;
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Presentaciones
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        Catálogo de unidades para cantidad 1 y cantidad 2 de los productos.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setIsFormOpen(true);
          }}
          className="inline-flex h-10 w-fit max-w-full shrink-0 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Nueva presentación
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: "nombre",
            header: "Nombre",
            primary: true,
            cell: (row) => row.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "estado",
            header: "Estado",
            cell: (row) => (
              <span
                className={
                  row.activo
                    ? "text-xs uppercase tracking-wider text-emerald-800"
                    : "text-xs uppercase tracking-wider text-vialto-steel"
                }
              >
                {row.activo ? "Activa" : "Inactiva"}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={error ? [] : paginatedRows}
        rowKey={(row) => row.id}
        emptyMessage={
          error
            ? "No se pudieron cargar las presentaciones."
            : "No hay presentaciones cargadas. Creá una para usarla en los productos."
        }
        loadingMessage="Cargando…"
        renderActions={(row) => (
          <>
            <button
              type="button"
              onClick={() => {
                setEditingId(row.id);
                setIsFormOpen(true);
              }}
              className={listadoTablaAccionClass}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => void eliminar(row)}
              className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
            >
              Eliminar
            </button>
          </>
        )}
      />

      {meta && (rows?.length ?? 0) > 0 && (
        <div className="mt-4">
          <ListadoPagination
            meta={meta}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded border border-black/10 bg-white p-5 shadow-lg"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide mb-4">
              {editingId ? "Editar presentación" : "Nueva presentación"}
            </h2>
            <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
              Nombre <span className="text-red-500">*</span>
              <input
                value={form.nombre}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nombre: e.target.value }))
                }
                className={`h-9 border px-2 text-sm normal-case tracking-normal ${fieldErrors.nombre ? "border-red-400" : "border-black/15"}`}
                autoFocus
              />
            </label>
            <CrudFieldError message={fieldErrors.nombre} />
            {editingId && (
              <label className="mt-3 flex items-center gap-2 text-sm text-vialto-charcoal cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, activo: e.target.checked }))
                  }
                  className="h-4 w-4"
                />
                Activa
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setIsFormOpen(false);
                  setFieldErrors({});
                }}
                className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 hover:bg-vialto-mist"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
