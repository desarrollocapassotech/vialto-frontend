import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Deposito, PaginatedMeta } from "@/types/api";

type DepositoFormState = {
  nombre: string;
  direccion: string;
  activo: boolean;
};

type DepositosPaginatedResponse = {
  items: Deposito[];
  meta: PaginatedMeta;
};

type DepositosPageProps = {
  isPlatform?: boolean;
  tenantId?: string;
};

function buildQs(params: Record<string, string>): string {
  const parts = Object.entries(params).map(
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  );
  return parts.length ? `?${parts.join("&")}` : "";
}

export function DepositosPage({
  isPlatform = false,
  tenantId = "",
}: DepositosPageProps) {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  // Tenant Manager
  const allTenants = useTenantsList({ enabled: isPlatform });
  const tenants = isPlatform ? allTenants : null;
  const [activeTenantId, setActiveTenantId] = useState(tenantId);

  // Determinar base de la API según el modo
  const apiBaseUrl = isPlatform
    ? "/api/platform/stock/depositos"
    : "/api/stock/depositos";

  const [depositos, setDepositos] = useState<Deposito[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingDepositoId, setEditingDepositoId] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState<DepositoFormState>({
    nombre: "",
    direccion: "",
    activo: true,
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroEstado("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroEstado;

  // Extracción de opciones únicas para el selector de Nombre
  const opcionesNombre = useMemo(
    () =>
      Array.from(
        new Set(
          (depositos || [])
            .map((r) => r.nombre)
            .filter((v): v is string => !!v),
        ),
      ).sort(),
    [depositos],
  );

  const rowsFiltradas = useMemo(() => {
    if (!depositos) return [];
    return depositos.filter((r) => {
      if (filtroNombre && r.nombre !== filtroNombre) return false;
      if (filtroEstado) {
        const isActive = filtroEstado === "true";
        if (r.activo !== isActive) return false;
      }
      return true;
    });
  }, [depositos, filtroNombre, filtroEstado]);

  const editarDeposito = useMemo(
    () => depositos?.find((d) => d.id === editingDepositoId) ?? null,
    [depositos, editingDepositoId],
  );

  // Limpiar vista cuando cambia la empresa en modo plataforma
  useEffect(() => {
    setPage(1);
    setIsFormOpen(false);
    setEditingDepositoId(null);
    setDepositos(null);
    setError(null);
    limpiarFiltros();
  }, [activeTenantId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Short-circuit: Si es admin y no eligió empresa, no buscamos nada
    if (isPlatform && !activeTenantId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const queryParams: Record<string, string> = {
          page: String(page),
          pageSize: String(pageSize),
        };
        if (isPlatform && activeTenantId) {
          queryParams.tenantId = activeTenantId;
        }

        const qs = buildQs(queryParams);
        const data = await apiJson<DepositosPaginatedResponse>(
          `${apiBaseUrl}${qs}`,
          () => getToken(),
        );

        if (!cancelled) {
          setDepositos(data.items);
          setMeta(data.meta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setDepositos(null);
          setMeta(null);
          setError(friendlyError(e, "stock"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    page,
    pageSize,
    isPlatform,
    activeTenantId,
    apiBaseUrl,
  ]);

  useEffect(() => {
    if (!isFormOpen) {
      setEditingDepositoId(null);
      return;
    }

    if (editarDeposito) {
      setForm({
        nombre: editarDeposito.nombre,
        direccion: editarDeposito.descripcion ?? "",
        activo: editarDeposito.activo,
      });
      return;
    }

    setForm({ nombre: "", direccion: "", activo: true });
  }, [editarDeposito, isFormOpen]);

  async function refresh() {
    if (isPlatform && !activeTenantId) return;

    setLoading(true);
    try {
      const queryParams: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (isPlatform && activeTenantId) {
        queryParams.tenantId = activeTenantId;
      }

      const qs = buildQs(queryParams);
      const data = await apiJson<DepositosPaginatedResponse>(
        `${apiBaseUrl}${qs}`,
        () => getToken(),
      );
      setDepositos(data.items);
      setMeta(data.meta);
      setError(null);
    } catch (e) {
      setDepositos(null);
      setMeta(null);
      setError(friendlyError(e, "stock"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !isSignedIn) return;

    if (!form.nombre.trim()) {
      setFieldErrors({ nombre: "Ingresá el nombre del depósito." });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || undefined,
        activo: form.activo,
      };

      // Si somos plataforma y estamos creando (POST), inyectamos el tenantId en el body
      if (isPlatform && !editingDepositoId && activeTenantId) {
        payload.tenantId = activeTenantId;
      }

      const queryParams: Record<string, string> = {};
      if (isPlatform && activeTenantId) {
        queryParams.tenantId = activeTenantId;
      }
      const qs = buildQs(queryParams);

      if (editingDepositoId) {
        await apiJson<Deposito>(
          `${apiBaseUrl}/${editingDepositoId}${qs}`,
          () => getToken(),
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      } else {
        await apiJson<Deposito>(`${apiBaseUrl}${qs}`, () => getToken(), {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await refresh();
      setIsFormOpen(false);
      setEditingDepositoId(null);
    } catch (e) {
      setError(friendlyError(e, "stock"));
    } finally {
      setSaving(false);
    }
  }

  function openCreateForm() {
    setEditingDepositoId(null);
    setIsFormOpen(true);
  }

  function openEditForm(deposito: Deposito) {
    setEditingDepositoId(deposito.id);
    setIsFormOpen(true);
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Depósitos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Almacená y administrá los puntos de depósito para tu stock.
      </p>

      {/* Buscador de empresas para plataforma */}
      {isPlatform && (
        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={activeTenantId}
            onChange={setActiveTenantId}
          />
        </div>
      )}

      {/* Estado vacío minimalista igual al de facturación */}
      {isPlatform && !activeTenantId && (
        <p className="mt-10 text-sm text-vialto-steel">
          Seleccioná una empresa para ver sus depósitos.
        </p>
      )}

      {/* Contenido operativo (se oculta si falta empresa en modo plataforma) */}
      {(!isPlatform || activeTenantId) && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {anyFiltroActivo && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
              >
                Limpiar filtros
              </button>
            )}
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex h-10 w-fit max-w-full shrink-0 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Nuevo depósito
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <ListadoDatos
            className={`mt-6 ${loading ? "opacity-50 pointer-events-none" : ""}`}
            tableColSpan={4}
            tableHead={
              <tr className={listadoTablaHeadRowClass}>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    title="Nombre"
                    filterActive={!!filtroNombre}
                    filterSignature={filtroNombre}
                  >
                    <select
                      value={filtroNombre}
                      onChange={(e) => {
                        setFiltroNombre(e.target.value);
                        setPage(1);
                      }}
                      className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                        filtroNombre
                          ? "text-vialto-fire"
                          : "text-vialto-charcoal"
                      }`}
                      aria-label="Filtrar por Nombre"
                    >
                      <option value="">Todos</option>
                      {opcionesNombre.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={listadoTablaThClass}>
                  Dirección
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    title="Activo"
                    filterActive={!!filtroEstado}
                    filterSignature={filtroEstado}
                  >
                    <select
                      value={filtroEstado}
                      onChange={(e) => {
                        setFiltroEstado(e.target.value);
                        setPage(1);
                      }}
                      className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                        filtroEstado
                          ? "text-vialto-fire"
                          : "text-vialto-charcoal"
                      }`}
                      aria-label="Filtrar por Estado"
                    >
                      <option value="">Todos</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </ViajesListadoHeaderFiltro>
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
                cell: (deposito) => deposito.nombre,
                tdClassName: `${listadoTablaTdClass} font-medium`,
              },
              {
                id: "direccion",
                header: "Dirección",
                cell: (deposito) => deposito.descripcion ?? "—",
                tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
              },
              {
                id: "activo",
                header: "Activo",
                cell: (deposito) => (deposito.activo ? "Sí" : "No"),
                tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
              },
            ]}
            rows={loading ? null : error ? [] : rowsFiltradas}
            rowKey={(deposito) => deposito.id}
            emptyMessage={
              error
                ? "No se pudieron cargar los depósitos."
                : anyFiltroActivo
                  ? "No hay depósitos que coincidan con los filtros aplicados."
                  : "Todavía no tenés depósitos cargados."
            }
            loadingMessage="Cargando…"
            renderActions={(deposito) => (
              <button
                type="button"
                onClick={() => openEditForm(deposito)}
                className={listadoTablaAccionClass}
              >
                Editar
              </button>
            )}
          />

          {meta && (rowsFiltradas?.length ?? 0) > 0 && (
            <ListadoPagination
              meta={meta}
              pageSize={pageSize}
              loading={loading}
              totalLabel="depósitos"
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          )}

          {isFormOpen && (
            <div className="mt-8 rounded border border-black/5 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">
                {editingDepositoId ? "Editar depósito" : "Nuevo depósito"}
              </h2>
              <p className="mt-1 text-sm text-vialto-steel">
                {editingDepositoId
                  ? "Actualizá los datos del depósito."
                  : "Cargá un depósito para aplicar stock."}
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="block text-sm font-semibold text-vialto-charcoal">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.nombre}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        nombre: event.target.value,
                      }))
                    }
                    className={`mt-2 w-full rounded border px-3 py-2 text-sm ${fieldErrors.nombre ? "border-red-400" : "border-black/10"}`}
                  />
                  <CrudFieldError message={fieldErrors.nombre} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-vialto-charcoal">
                    Dirección
                  </label>
                  <input
                    value={form.direccion}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        direccion: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded border border-black/10 px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-vialto-charcoal">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          activo: event.target.checked,
                        }))
                      }
                    />
                    Activo
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingDepositoId(null);
                      setError(null);
                      setFieldErrors({});
                    }}
                    className="inline-flex h-10 items-center px-4 border border-black/10 text-sm uppercase tracking-wider hover:bg-vialto-mist"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
