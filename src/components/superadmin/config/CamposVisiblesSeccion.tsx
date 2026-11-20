import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { History } from "lucide-react";
import { ViewModalShell } from "@/components/ui/ViewModalShell";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { ordenarAlfabetico } from "@/lib/ordenAlfabetico";
import {
  ConfigFila,
  ConfigSeccion,
  ToggleSwitch,
  configSelectClass,
} from "./ConfigUi";

export type CampoCatalogo = {
  campo: string;
  label: string;
  obligatorioSistema: boolean;
};

export type ModuloCatalogo = {
  label: string;
  formularios: Record<string, { label: string; campos: CampoCatalogo[] }>;
};

export type Catalogo = Record<string, ModuloCatalogo>;

type CampoConfig = CampoCatalogo & { visible: boolean };

/**
 * Módulos cuyos formularios son etapas del mismo registro (alta/edición/detalle):
 * el backend comparte la visibilidad entre los tres (`MODULOS_CAMPOS_COMPARTIDOS`
 * en `tenant-field-config.service.ts`), así que no se muestra el selector de
 * formulario ni "Aplicar a todos". `stock` queda afuera a propósito: sus
 * formularios (ingreso/egreso/división) son operaciones distintas.
 */
const MODULOS_CAMPOS_COMPARTIDOS = new Set([
  "viajes",
  "clientes",
  "transportistas",
  "vehiculos",
  "choferes",
  "liquidaciones",
]);

/** Lista de switches "campo visible" de un módulo para la empresa elegida. */
export function CamposVisiblesSeccion({
  orgId,
  modulo,
  catalogoModulo,
  ocultarCampos,
}: {
  orgId: string;
  modulo: string;
  catalogoModulo: ModuloCatalogo;
  /** Campos que se configuran en otro lado (ej. Choferes/Vehículos/Productos de Viajes, en General). */
  ocultarCampos?: ReadonlySet<string>;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const formularios = Object.keys(catalogoModulo.formularios);
  const compartido = MODULOS_CAMPOS_COMPARTIDOS.has(modulo);
  const [formulario, setFormulario] = useState(formularios[0] ?? "");
  const [aplicarATodos, setAplicarATodos] = useState(false);
  const [campos, setCampos] = useState<CampoConfig[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState(false);

  // El host lo monta con `key={modulo}`: al cambiar de módulo arranca de cero.
  useEffect(() => {
    if (!formulario) return;
    let cancelled = false;
    // No se vacía `campos` para que la lista no desaparezca (y no salte el scroll).
    setLoading(true);
    (async () => {
      try {
        const data = await apiJson<CampoConfig[]>(
          `/api/platform/field-config/${encodeURIComponent(orgId)}?modulo=${modulo}&formulario=${formulario}`,
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
  }, [getToken, orgId, modulo, formulario]);

  async function toggle(c: CampoConfig) {
    const visible = !c.visible;
    setGuardando(c.campo);
    try {
      await apiJson(
        `/api/platform/field-config/${encodeURIComponent(orgId)}/toggle`,
        () => getToken(),
        {
          method: "POST",
          body: JSON.stringify({
            modulo,
            formulario,
            campo: c.campo,
            visible,
            aplicarATodosLosFormularios: aplicarATodos,
          }),
        },
      );
      setCampos((prev) =>
        prev
          ? prev.map((x) => (x.campo === c.campo ? { ...x, visible } : x))
          : prev,
      );
      showToast("Cambios guardados", "success");
    } catch (e) {
      showToast(friendlyError(e, "camposEmpresa"), "error");
    } finally {
      setGuardando(null);
    }
  }

  // Los obligatorios del sistema no se pueden ocultar: no se listan.
  const configurables =
    campos?.filter(
      (c) => !c.obligatorioSistema && !ocultarCampos?.has(c.campo),
    ) ?? null;

  return (
    <>
      <ConfigSeccion
        titulo="Campos visibles"
        columnas
        acciones={
          <button
            type="button"
            onClick={() => setHistorialAbierto(true)}
            className="inline-flex items-center gap-1.5 text-xs text-vialto-steel hover:text-vialto-charcoal hover:underline"
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            Historial
          </button>
        }
        barra={
          !compartido && formularios.length > 0 ? (
            <>
              <label className="flex items-center gap-2 text-sm text-vialto-steel">
                Formulario
                <select
                  value={formulario}
                  onChange={(e) => setFormulario(e.target.value)}
                  className={`${configSelectClass} w-56`}
                >
                  {ordenarAlfabetico(
                    formularios,
                    (f) => catalogoModulo.formularios[f].label,
                  ).map((f) => (
                    <option key={f} value={f}>
                      {catalogoModulo.formularios[f].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-vialto-steel">
                <ToggleSwitch
                  checked={aplicarATodos}
                  onChange={() => setAplicarATodos((v) => !v)}
                  label="Aplicar cambios a todos los formularios del módulo"
                />
                Aplicar a todos los formularios
              </label>
            </>
          ) : undefined
        }
      >
        {error && (
          <p className="col-span-full px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {!configurables && loading && (
          <p className="col-span-full px-4 py-6 text-center text-sm text-vialto-steel">
            Cargando…
          </p>
        )}
        {configurables?.length === 0 && (
          <p className="col-span-full px-4 py-6 text-center text-sm text-vialto-steel">
            No hay campos configurables para este formulario.
          </p>
        )}
        {configurables?.map((c) => (
          <ConfigFila key={c.campo} label={c.label}>
            <ToggleSwitch
              checked={c.visible}
              disabled={loading || guardando === c.campo}
              onChange={() => void toggle(c)}
              label={`${c.visible ? "Ocultar" : "Mostrar"} ${c.label}`}
            />
          </ConfigFila>
        ))}
      </ConfigSeccion>

      {historialAbierto && (
        <HistorialCamposModal
          orgId={orgId}
          modulo={modulo}
          formulario={formulario}
          formularioLabel={
            catalogoModulo.formularios[formulario]?.label ?? formulario
          }
          onClose={() => setHistorialAbierto(false)}
        />
      )}
    </>
  );
}

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

function HistorialCamposModal({
  orgId,
  modulo,
  formulario,
  formularioLabel,
  onClose,
}: {
  orgId: string;
  modulo: string;
  formulario: string;
  formularioLabel: string;
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [filtro, setFiltro] = useState<"formulario" | "todo">("formulario");
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLogs(null);
    setError(null);
    (async () => {
      try {
        const base = `/api/platform/field-config/${encodeURIComponent(orgId)}/audit`;
        const url =
          filtro === "formulario"
            ? `${base}?modulo=${modulo}&formulario=${formulario}`
            : base;
        const data = await apiJson<AuditLog[]>(url, () => getToken());
        if (!cancelled) setLogs(data);
      } catch (e) {
        if (!cancelled) {
          setLogs([]);
          setError(friendlyError(e, "camposEmpresa"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId, modulo, formulario, filtro]);

  return (
    <ViewModalShell
      title="Historial de cambios"
      onClose={onClose}
      maxWidthClass="sm:max-w-4xl"
      scrollBody
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-vialto-steel">Mostrar:</span>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="historialFiltro"
            checked={filtro === "formulario"}
            onChange={() => setFiltro("formulario")}
            className="accent-vialto-charcoal"
          />
          Este formulario ({formularioLabel})
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="historialFiltro"
            checked={filtro === "todo"}
            onChange={() => setFiltro("todo")}
            className="accent-vialto-charcoal"
          />
          Toda la empresa
        </label>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-black/10 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel">
            <th className="pb-3 pr-4">Fecha</th>
            <th className="px-4 pb-3">Módulo / Formulario</th>
            <th className="px-4 pb-3">Campo</th>
            <th className="px-4 pb-3 text-center">Cambio</th>
            <th className="pb-3 pl-4">Usuario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {logs === null ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-vialto-steel">
                Cargando historial…
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-vialto-steel">
                {error ?? "No hay cambios registrados."}
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap py-3 pr-4">
                  {new Date(log.createdAt).toLocaleString("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-vialto-steel">
                  {log.modulo}
                  <br />
                  <span className="text-xs">{log.formulario}</span>
                </td>
                <td className="px-4 py-3 font-medium">{log.campo}</td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                      log.estadoNuevo
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {log.estadoAnterior ? "Visible" : "Oculto"} →{" "}
                    {log.estadoNuevo ? "Visible" : "Oculto"}
                  </span>
                </td>
                <td className="py-3 pl-4 text-xs text-vialto-steel">
                  {log.userName}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ViewModalShell>
  );
}
