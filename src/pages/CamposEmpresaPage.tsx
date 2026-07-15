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

export function CamposEmpresaPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();

  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [catalogoError, setCatalogoError] = useState<string | null>(null);

  const [modulo, setModulo] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<string | null>(null);
  const [campos, setCampos] = useState<CampoConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingCampo, setSavingCampo] = useState<string | null>(null);
  const [aplicarATodos, setAplicarATodos] = useState(false);

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
            primerModulo ? (Object.keys(data[primerModulo])[0] ?? null) : null,
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
          ? prev.map((c) => (c.campo === campo ? { ...c, visible: nuevoVisible } : c))
          : prev,
      );
    } catch (e) {
      setError(friendlyError(e, "camposEmpresa"));
    } finally {
      setSavingCampo(null);
    }
  }

  const modulosDisponibles = catalogo ? Object.keys(catalogo) : [];
  const formulariosDelModulo =
    catalogo && modulo ? Object.keys(catalogo[modulo].formularios) : [];

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Configuración por empresa
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa y un formulario para configurar qué campos ve. Los
        campos ocultos no se muestran en alta, edición ni detalle.
      </p>

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
            <nav className="-mb-px flex gap-1" aria-label="Módulos configurables">
              {modulosDisponibles.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setModulo(m);
                    setFormulario(Object.keys(catalogo[m].formularios)[0] ?? null);
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
            Aplicar cambios a todos los formularios del módulo (alta, edición y detalle)
          </label>

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
                    <td colSpan={2} className="px-4 py-6 text-center text-vialto-steel">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!loading && campos && campos.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-vialto-steel">
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
                          disabled={c.obligatorioSistema || savingCampo === c.campo}
                          onClick={() => toggleCampo(c.campo, c.visible)}
                          className={[
                            "inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            c.visible ? "bg-vialto-charcoal" : "bg-black/20",
                            c.obligatorioSistema ? "opacity-50 cursor-not-allowed" : "",
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
    </div>
  );
}