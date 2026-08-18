import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import { PaisModal } from "@/components/viajes/PaisModal";
import { PaisViewModal } from "@/components/viajes/PaisViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ApiError, apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import type { Pais } from "@/types/api";

export function PaisesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Pais[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingPais, setViewingPais] = useState<Pais | null>(null);
  const [editingPais, setEditingPais] = useState<Pais | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Pais | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    const data = await apiJson<Pais[]>("/api/paises", () => getToken());
    setRows(data);
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, "paises"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load]);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await apiJson(
        `/api/paises/${encodeURIComponent(confirmDelete.id)}`,
        () => getToken(),
        { method: "DELETE" },
      );
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setDeleteError(
        e instanceof ApiError && e.status === 400
          ? e.message
          : friendlyError(e, "paises"),
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Países
      </h1>
      <p className="mt-2 text-vialto-steel">
        Los países disponibles para origen y destino en tus viajes.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear país
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-6"
        tableColSpan={3}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={listadoTablaThClass}>
              Nombre
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Código
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        columns={[
          {
            id: "nombre",
            header: "Nombre",
            primary: true,
            cell: (p) => p.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "codigo",
            header: "Código",
            cell: (p) => p.codigo ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows ?? []}
        rowKey={(p) => p.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los países."
            : "Todavía no tenés países cargados."
        }
        loadingMessage="Cargando…"
        renderActions={(p) => (
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={() => setViewingPais(p)}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
            {!p.esPredefinido && (
              <>
                <button
                  type="button"
                  onClick={() => setEditingPais(p)}
                  className={listadoTablaAccionClass}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDelete(p);
                  }}
                  className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        )}
      />

      {viewingPais && (
        <PaisViewModal
          pais={viewingPais}
          onClose={() => setViewingPais(null)}
        />
      )}

      {creating && (
        <PaisModal
          getToken={getToken}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {editingPais && (
        <PaisModal
          getToken={getToken}
          pais={editingPais}
          onClose={() => setEditingPais(null)}
          onSaved={() => {
            setEditingPais(null);
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar país"
        message={
          deleteError
            ? deleteError
            : `¿Eliminar "${confirmDelete?.nombre}"? Esta acción no se puede deshacer.`
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={deleteBusy}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
