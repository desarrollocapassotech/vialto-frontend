import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { PaisModal } from "@/components/viajes/PaisModal";
import { PaisViewModal } from "@/components/viajes/PaisViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { ApiError, apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import type { Pais } from "@/types/api";

export function PaisesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const tenants = useTenantsList();

  const [rows, setRows] = useState<Pais[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingPais, setViewingPais] = useState<Pais | null>(null);
  const [editingPais, setEditingPais] = useState<Pais | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Pais | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useMemo(
    () => async () => {
      if (!isLoaded || !isSignedIn || !filtroEmpresa) return;
      const data = await apiJson<Pais[]>(
        `/api/platform/paises?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
      );
      setRows(data);
    },
    [getToken, isLoaded, isSignedIn, filtroEmpresa],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    setLoading(true);
    (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, "paises"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, filtroEmpresa, load]);

  async function handleDelete() {
    if (!confirmDelete || !filtroEmpresa) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await apiJson(
        `/api/platform/paises/${encodeURIComponent(confirmDelete.id)}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
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
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus países.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={!filtroEmpresa}
          onClick={() => setCreating(true)}
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? "bg-vialto-charcoal hover:bg-vialto-graphite"
              : "bg-vialto-charcoal/50 pointer-events-none"
          }`}
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
        rows={!filtroEmpresa || error ? [] : rows ?? []}
        rowKey={(p) => p.id}
        emptyMessage={
          !filtroEmpresa
            ? "Seleccioná una empresa para ver sus países."
            : error
              ? "No se pudieron cargar los países."
              : "No hay países cargados para esta empresa."
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

      {creating && filtroEmpresa && (
        <PaisModal
          getToken={getToken}
          tenantId={filtroEmpresa}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}

      {editingPais && filtroEmpresa && (
        <PaisModal
          getToken={getToken}
          tenantId={filtroEmpresa}
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
