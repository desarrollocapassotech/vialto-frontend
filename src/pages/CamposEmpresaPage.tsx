import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { ImportTemplatesConfig } from "@/components/importacion/ImportTemplatesConfig";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { canAccessViajes, canAccessStock } from "@/lib/tenantModules";
import type { Tenant } from "@/types/api";

/**
 * Módulos de `FIELD_CATALOG` que son módulos vendibles reales (`Tenant.modules`)
 * y por lo tanto deben ocultarse si el tenant no los contrató. Los que no
 * aparecen acá (`clientes`/`transportistas`/`vehiculos`) son entidades del
 * core, siempre presentes — nunca se filtran (ver `vialto-backend/CLAUDE.md`,
 * "Entidades del Core").
 */
const MODULO_GATE: Record<string, (modules: string[]) => boolean> = {
  viajes: canAccessViajes,
  stock: canAccessStock,
};

function calcularModulosDisponibles(
  catalogo: Catalogo | null,
  tenant: Tenant | null,
): string[] {
  if (!catalogo) return [];
  return Object.keys(catalogo).filter((m) => {
    const gate = MODULO_GATE[m];
    if (!gate) return true;
    return !!tenant && gate(tenant.modules);
  });
}

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

/** Mismo look & feel en toda la pantalla: charcoal = activo, rojo = apagado. */
function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      aria-pressed={checked}
      aria-label={label}
      className={[
        "inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-vialto-charcoal" : "bg-red-500",
      ].join(" ")}
    >
      <span
        className={[
          "h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

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
  // Pestaña "Templates de importación" — vive en la misma barra de tabs que
  // los módulos (Viajes/Stock/...), no como sección aparte apilada.
  const [mostrarTemplates, setMostrarTemplates] = useState(false);

  // --- NUEVOS ESTADOS PARA AUDITORÍA ---
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<"todo" | "formulario">(
    "formulario",
  );

  // --- CONFIGURACIÓN GENERAL DE LA EMPRESA (independiente de módulo/formulario) ---
  // Mismo criterio que el resto de la pantalla: cada campo guarda apenas se
  // edita, sin un botón "Guardar" aparte.
  const { showToast } = useToast();
  const [empresaLabel, setEmpresaLabel] = useState("");
  const [empresaLabelGuardado, setEmpresaLabelGuardado] = useState("");
  const [empresaImportOculto, setEmpresaImportOculto] = useState(false);
  const [loadingEmpresaConfig, setLoadingEmpresaConfig] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [savingImportToggle, setSavingImportToggle] = useState(false);
  const [empresaConfigError, setEmpresaConfigError] = useState<string | null>(
    null,
  );
  // Tenant completo (nombre + módulos contratados) — lo necesita la sección
  // de templates de importación de abajo (`ImportTemplatesConfig`).
  const [empresaTenant, setEmpresaTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !filtroEmpresa) return;
    let cancelled = false;
    setLoadingEmpresaConfig(true);
    setEmpresaConfigError(null);
    (async () => {
      try {
        const tenant = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) {
          const label = tenant.labelIdentificacionPersonalizadaViajes ?? "";
          setEmpresaLabel(label);
          setEmpresaLabelGuardado(label);
          setEmpresaImportOculto(tenant.importacionesOcultas ?? false);
          setEmpresaTenant(tenant);
        }
      } catch (e) {
        if (!cancelled) setEmpresaConfigError(friendlyError(e, "camposEmpresa"));
      } finally {
        if (!cancelled) setLoadingEmpresaConfig(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  async function guardarEmpresaLabel() {
    if (!filtroEmpresa || empresaLabel === empresaLabelGuardado) return;
    setSavingLabel(true);
    setEmpresaConfigError(null);
    try {
      await apiJson(`/api/tenants/${encodeURIComponent(filtroEmpresa)}`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({
          labelIdentificacionPersonalizadaViajes: empresaLabel.trim() || null,
        }),
      });
      setEmpresaLabelGuardado(empresaLabel);
      showToast("Label actualizado", "success");
    } catch (e) {
      setEmpresaConfigError(friendlyError(e, "camposEmpresa"));
    } finally {
      setSavingLabel(false);
    }
  }

  async function toggleImportOculto() {
    if (!filtroEmpresa) return;
    const nuevoValor = !empresaImportOculto;
    setSavingImportToggle(true);
    setEmpresaConfigError(null);
    try {
      await apiJson(`/api/tenants/${encodeURIComponent(filtroEmpresa)}`, () => getToken(), {
        method: "PATCH",
        body: JSON.stringify({ importacionesOcultas: nuevoValor }),
      });
      setEmpresaImportOculto(nuevoValor);
    } catch (e) {
      setEmpresaConfigError(friendlyError(e, "camposEmpresa"));
    } finally {
      setSavingImportToggle(false);
    }
  }

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
    // No reseteamos 'campos' a null aquí para evitar que la tabla desaparezca
    // y provoque que el navegador haga scroll hacia arriba bruscamente.
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

  // Si el módulo activo deja de estar disponible para el tenant elegido (ej.
  // se cambió de un tenant con Stock a uno sin Stock), se cae al primer
  // módulo que sí tenga. Espera a que `empresaTenant` haya cargado — antes de
  // eso `calcularModulosDisponibles` oculta todo lo gateado por no saber
  // todavía los módulos contratados, y correría igual aunque el tenant sí
  // tenga el módulo activo.
  useEffect(() => {
    if (!catalogo || !modulo || !filtroEmpresa || !empresaTenant) return;
    const disponibles = calcularModulosDisponibles(catalogo, empresaTenant);
    if (disponibles.includes(modulo)) return;
    const siguiente = disponibles[0] ?? null;
    setModulo(siguiente);
    setFormulario(
      siguiente ? (Object.keys(catalogo[siguiente].formularios)[0] ?? null) : null,
    );
    setMostrarTemplates(false);
  }, [catalogo, empresaTenant, modulo, filtroEmpresa]);

  const modulosDisponibles = calcularModulosDisponibles(catalogo, empresaTenant);
  const formulariosDelModulo =
    catalogo && modulo ? Object.keys(catalogo[modulo].formularios) : [];
  // Los campos obligatorios del sistema no se pueden ocultar — no tiene
  // sentido mostrarlos en esta pantalla, solo agregan ruido.
  const camposConfigurables = campos?.filter((c) => !c.obligatorioSistema) ?? null;

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

      {filtroEmpresa && (
        <div className="mt-6">
          <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel">
            Configuración general
          </h2>
          {empresaConfigError && (
            <p className="mt-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {empresaConfigError}
            </p>
          )}
          <div className="mt-2 overflow-hidden border border-black/15">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-vialto-mist text-left">
                  <th className="px-4 py-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel">
                    Campo
                  </th>
                  <th className="px-4 py-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel text-right">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingEmpresaConfig ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-vialto-steel">
                      Cargando…
                    </td>
                  </tr>
                ) : (
                  <>
                    <tr className="border-t border-black/10">
                      <td className="px-4 py-2.5">
                        Label del ID propio (módulo Viajes)
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          value={empresaLabel}
                          onChange={(e) => setEmpresaLabel(e.target.value)}
                          onBlur={() => void guardarEmpresaLabel()}
                          disabled={savingLabel}
                          placeholder="ID propio"
                          className="h-9 w-full max-w-xs border border-black/15 bg-white px-3 text-sm text-left disabled:opacity-50"
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-black/10">
                      <td className="px-4 py-2.5">
                        Ocultar importación masiva de Excel para el admin
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ToggleSwitch
                          checked={empresaImportOculto}
                          disabled={savingImportToggle}
                          onChange={() => void toggleImportOculto()}
                          label={
                            empresaImportOculto
                              ? "Mostrar importación masiva"
                              : "Ocultar importación masiva"
                          }
                        />
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtroEmpresa && catalogo && modulo && formulario && (
        <>
          <div className="mt-6 border-b border-black/15">
            <nav
              className="-mb-px flex flex-wrap gap-1"
              aria-label="Módulos configurables"
            >
              {modulosDisponibles.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMostrarTemplates(false);
                    setModulo(m);
                    setFormulario(
                      Object.keys(catalogo[m].formularios)[0] ?? null,
                    );
                  }}
                  className={[
                    "flex shrink-0 items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                    !mostrarTemplates && modulo === m
                      ? "border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal"
                      : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  {catalogo[m].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setMostrarTemplates(true)}
                className={[
                  "flex shrink-0 items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                  mostrarTemplates
                    ? "border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal"
                    : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
                ].join(" ")}
              >
                Templates de importación
              </button>
            </nav>
          </div>

          {mostrarTemplates && empresaTenant && (
            <div className="border border-t-0 border-black/15 bg-white p-6">
              <p className="mb-4 text-sm text-vialto-steel">
                Mapeo de columnas del Excel a los campos del sistema, por
                módulo — lo mismo que se configura desde "Configurar
                templates" al importar datos de esta empresa.
              </p>
              <ImportTemplatesConfig
                tenantId={filtroEmpresa}
                tenantNombre={empresaTenant.name}
                tenantModules={empresaTenant.modules}
                embedded
              />
            </div>
          )}

          {!mostrarTemplates && (
          <>
          <div className="border border-t-0 border-black/15 bg-white p-4 flex flex-wrap items-end gap-6">
            {modulo !== "viajes" && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                  Formulario
                </span>
                <select
                  value={formulario}
                  onChange={(e) => setFormulario(e.target.value)}
                  className="h-9 w-56 border border-black/15 bg-white px-2 text-sm"
                >
                  {formulariosDelModulo.map((f) => (
                    <option key={f} value={f}>
                      {catalogo[modulo].formularios[f].label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {modulo !== "viajes" && (
              <div className="flex items-center gap-3">
                <ToggleSwitch
                  checked={aplicarATodos}
                  onChange={() => setAplicarATodos((v) => !v)}
                  label="Aplicar cambios a todos los formularios del módulo"
                />
                <span className="max-w-xs text-sm text-vialto-steel">
                  Aplicar cambios a todos los formularios del módulo
                </span>
              </div>
            )}
          </div>

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
              <tbody className={loading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                {loading && (!camposConfigurables || camposConfigurables.length === 0) && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-vialto-steel"
                    >
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && camposConfigurables && camposConfigurables.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-vialto-steel"
                    >
                      No hay campos configurables para este formulario.
                    </td>
                  </tr>
                )}
                {camposConfigurables?.map((c) => (
                  <tr key={c.campo} className="border-t border-black/10">
                    <td className="px-4 py-2.5">{c.label}</td>
                    <td className="px-4 py-2.5 text-right">
                      <ToggleSwitch
                        checked={c.visible}
                        disabled={savingCampo === c.campo}
                        onChange={() => toggleCampo(c.campo, c.visible)}
                        label={`${c.visible ? "Ocultar" : "Mostrar"} ${c.label}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )}
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
