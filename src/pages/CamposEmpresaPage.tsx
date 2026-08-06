import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";

type CampoCatalogo = {
  campo: string;
  label: string;
  obligatorioSistema: boolean;
};

type FormularioCatalogo = {
  label: string;
  campos: CampoCatalogo[];
};

type ModuloCatalogo = {
  label: string;
  formularios: Record<string, FormularioCatalogo>;
};

type Catalogo = Record<string, ModuloCatalogo>;

type CampoConfig = {
  campo: string;
  label: string;
  obligatorioSistema: boolean;
  visible: boolean;
};

// NUEVO TIPO para el historial
type AuditLog = {
  id: string;
  modulo: string;
  formulario: string;
  campo: string;
  estadoAnterior: boolean;
  estadoNuevo: boolean;
  userId: string;
  userName: string;
  createdAt: string;
};

export function CamposEmpresaPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();

  // --- ESTADOS ORIGINALES ---
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);
  const [modulo, setModulo] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<string | null>(null);
  const [campos, setCampos] = useState<CampoConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingCampo, setSavingCampo] = useState<string | null>(null);
  const [aplicarATodos, setAplicarATodos] = useState(false);

  // --- NUEVOS ESTADOS PARA AUDITORÍA ---
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<"todo" | "formulario">(
    "formulario",
  );

  // Carga del catálogo completo (módulos/formularios disponibles) al montar
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Catalogo>(
          "/api/platform/field-config/catalogo",
          () => getToken(),
        );
        if (!cancelled) {
          setCatalogo(data);
          setCatalogoError(null);
          const primerModulo = Object.keys(data)[0] ?? null;
          setModulo(primerModulo);
          setFormulario(
            primerModulo
              ? (Object.keys(data[primerModulo].formularios)[0] ?? null)
              : null,
          );
        }
      } catch (e) {
        if (!cancelled) setCatalogoError(friendlyError(e, "camposEmpresa"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  // Carga de la config efectiva del formulario elegido, para la empresa elegida
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa || !modulo || !formulario) {
      setCampos(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setCampos(null);
    setLoading(true);
    (async () => {
      try {
        const data = await apiJson<CampoConfig[]>(
          `/api/platform/field-config/${encodeURIComponent(filtroEmpresa)}?modulo=${modulo}&formulario=${formulario}`,
          () => getToken(),
        );
        if (!cancelled) {
          setCampos(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setCampos(null);
          setError(friendlyError(e, "camposEmpresa"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa, modulo, formulario]);

  async function toggleCampo(campo: string, visibleActual: boolean) {
    if (!filtroEmpresa || !modulo || !formulario) return;
    setSavingCampo(campo);
    setError(null);
    const nuevoVisible = !visibleActual;
    try {
      await apiJson(
        `/api/platform/field-config/${encodeURIComponent(filtroEmpresa)}/toggle`,
        () => getToken(),
        {
          method: "POST",
          body: JSON.stringify({
            modulo,
            formulario,
            campo,
            visible: nuevoVisible,
            aplicarATodosLosFormularios: aplicarATodos,
          }),
        },
      );
      setCampos((prev) =>
        prev
          ? prev.map((c) =>
              c.campo === campo ? { ...c, visible: nuevoVisible } : c,
            )
          : prev,
      );
    } catch (e) {
      setError(friendlyError(e, "camposEmpresa"));
    } finally {
      setSavingCampo(null);
    }
  }

  // --- NUEVA FUNCIÓN PARA CARGAR EL HISTORIAL ---
  const fetchAuditLogs = async (filterByForm: boolean) => {
    if (!filtroEmpresa || !modulo || !formulario) return;
    setLoadingAudit(true);
    try {
      const url = filterByForm
        ? `/api/platform/field-config/${encodeURIComponent(filtroEmpresa)}/audit?modulo=${modulo}&formulario=${formulario}`
        : `/api/platform/field-config/${encodeURIComponent(filtroEmpresa)}/audit`;

      const data = await apiJson<AuditLog[]>(url, () => getToken());
      setAuditLogs(data);
    } catch (e) {
      console.error("Error cargando auditoría", e);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Cargar auditoría cuando se abre el modal o cambia el filtro
  useEffect(() => {
    if (showAuditModal) {
      fetchAuditLogs(auditFilter === "formulario");
    }
  }, [showAuditModal, auditFilter, modulo, formulario]);

  const modulosDisponibles = catalogo ? Object.keys(catalogo) : [];
  const formulariosDelModulo =
    catalogo && modulo ? Object.keys(catalogo[modulo].formularios) : [];

  return (
    <div className="w-full">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
            Configuración por empresa
          </h1>
          <p className="mt-2 text-vialto-steel max-w-3xl">
            Elegí una empresa y un formulario para configurar qué campos se
            visualizan.
          </p>
        </div>
      </div>

      {catalogoError && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {catalogoError}
        </p>
      )}

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>

      {filtroEmpresa && catalogo && modulo && formulario && (
        <>
          <div className="mt-6 border-b border-black/15">
            <nav
              className="-mb-px flex gap-1"
              aria-label="Módulos configurables"
            >
              {modulosDisponibles.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModulo(m);
                    setFormulario(
                      Object.keys(catalogo[m].formularios)[0] ?? null,
                    );
                  }}
                  className={[
                    "flex shrink-0 items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                    modulo === m
                      ? "border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal"
                      : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  {catalogo[m].label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-4 flex flex-col gap-1 max-w-xs">
            <span className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
              Formulario
            </span>
            <select
              value={formulario}
              onChange={(e) => setFormulario(e.target.value)}
              className="h-9 border border-black/15 bg-white px-2 text-sm"
            >
              {formulariosDelModulo.map((f) => (
                <option key={f} value={f}>
                  {catalogo[modulo].formularios[f].label}
                </option>
              ))}
            </select>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-vialto-steel">
            <input
              type="checkbox"
              checked={aplicarATodos}
              onChange={(e) => setAplicarATodos(e.target.checked)}
              className="accent-vialto-charcoal"
            />
            Aplicar cambios a todos los formularios del módulo (alta, edición y
            detalle)
          </label>

          {filtroEmpresa && (
            <div className="mt-8">
              <button
                onClick={() => setShowAuditModal(true)}
                className="flex w-max items-center gap-2 rounded border border-black/15 bg-white px-4 py-2 text-sm font-medium text-vialto-charcoal shadow-sm transition hover:bg-black/5"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Ver Historial
              </button>
            </div>
          )}
          {error && (
            <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="mt-6 overflow-hidden border border-black/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-vialto-mist text-left">
                  <th className="px-4 py-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel">
                    Campo
                  </th>
                  <th className="px-4 py-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel text-right">
                    Visible
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-vialto-steel"
                    >
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && campos && campos.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-vialto-steel"
                    >
                      No hay campos configurables para este formulario.
                    </td>
                  </tr>
                )}
                {!loading &&
                  campos?.map((c) => (
                    <tr key={c.campo} className="border-t border-black/10">
                      <td className="px-4 py-2.5">
                        {c.label}
                        {c.obligatorioSistema && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-vialto-steel/70">
                            (obligatorio)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={
                            c.obligatorioSistema || savingCampo === c.campo
                          }
                          onClick={() => toggleCampo(c.campo, c.visible)}
                          className={[
                            "inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            c.visible ? "bg-vialto-charcoal" : "bg-black/20",
                            c.obligatorioSistema
                              ? "opacity-50 cursor-not-allowed"
                              : "",
                          ].join(" ")}
                          aria-pressed={c.visible}
                          aria-label={`${c.visible ? "Ocultar" : "Mostrar"} ${c.label}`}
                        >
                          <span
                            className={[
                              "h-5 w-5 rounded-full bg-white shadow transition-transform",
                              c.visible ? "translate-x-5" : "translate-x-0.5",
                            ].join(" ")}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* NUEVO MODAL DE AUDITORÍA */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-md bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
              <div>
                <h2 className="text-xl font-[family-name:var(--font-display)]">
                  Historial de Cambios
                </h2>
                <p className="text-sm text-vialto-steel mt-1">
                  Empresa: {filtroEmpresa}
                </p>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-vialto-steel hover:text-black font-medium"
              >
                Cerrar
              </button>
            </div>

            <div className="flex items-center gap-4 border-b border-black/10 bg-vialto-mist/30 px-6 py-2 text-sm">
              <span className="text-vialto-steel">Filtrar por:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="auditFilter"
                  checked={auditFilter === "formulario"}
                  onChange={() => setAuditFilter("formulario")}
                  className="accent-vialto-charcoal"
                />
                Formulario actual ({formulario})
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="auditFilter"
                  checked={auditFilter === "todo"}
                  onChange={() => setAuditFilter("todo")}
                  className="accent-vialto-charcoal"
                />
                Toda la empresa
              </label>
            </div>

            <div className="overflow-auto p-6">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-black/10 text-vialto-steel font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider">
                    <th className="pb-3 pr-4">Fecha</th>
                    <th className="pb-3 px-4">Módulo / Formulario</th>
                    <th className="pb-3 px-4">Campo</th>
                    <th className="pb-3 px-4 text-center">Cambio</th>
                    <th className="pb-3 pl-4">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {loadingAudit ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-vialto-steel"
                      >
                        Cargando historial...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-8 text-center text-vialto-steel"
                      >
                        No hay registros de auditoría para este filtro.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-black/5 transition-colors"
                      >
                        <td className="py-3 pr-4 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-3 px-4 text-vialto-steel">
                          {log.modulo} <br />{" "}
                          <span className="text-xs">{log.formulario}</span>
                        </td>
                        <td className="py-3 px-4 font-medium">{log.campo}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${log.estadoNuevo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                          >
                            {log.estadoAnterior ? "Visible" : "Oculto"} →{" "}
                            {log.estadoNuevo ? "Visible" : "Oculto"}
                          </span>
                        </td>
                        <td className="py-3 pl-4 text-xs font-mono text-vialto-steel">
                          {log.userName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
