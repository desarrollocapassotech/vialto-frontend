import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { SuperadminOnly } from "@/components/superadmin/SuperadminOnly";
import { useImportTemplates } from "@/hooks/useImportTemplates";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { labelModulo } from "@/lib/platformLabels";
import type { Tenant } from "@/types/api";

/** Campo fijo del catálogo del backend (`TEMPLATE_CATALOGO`) para un módulo. */
type CatalogoColumn = {
  field: string;
  campoLabel: string;
  type: "string" | "number" | "date" | "boolean" | "lookup" | "enum";
  systemRequired: boolean;
  defaultExcelHeader: string;
  lookupModel?: string;
  lookupFields?: string[];
  createIfNotFoundSoportado?: boolean;
  multiple?: boolean;
  separador?: string;
  allowedValues?: string[];
  format?: string;
  /** true = recomendado pero no bloqueante — se importa igual con confirmación del usuario. */
  warnIfEmpty?: boolean;
};

/** Fila editable de la tabla de configuración: el catálogo fijo + lo que el superadmin ajusta. */
type EditableColumn = CatalogoColumn & {
  excelHeader: string;
  required: boolean;
  defaultValue: string;
  createIfNotFound: boolean;
};

/** Respuesta de la sugerencia de mapeo con IA — nunca se guarda sola, solo precarga el formulario. */
type SugerenciaTemplate = {
  proveedor: "Gemini" | "Groq";
  modelo: string;
  sheet: string;
  headerRow: number;
  columnas: Array<{ field: string; excelHeader: string }>;
  headersNoUsados: string[];
};

/** Un campo que la última sugerencia de IA efectivamente cambió, para mostrar antes/después. */
type CambioIA = { label: string; antes: string; despues: string };

const SHEET_DEFAULT: Record<string, string> = {
  clientes: "Clientes",
  transportistas: "Transportes",
  choferes: "Choferes",
  vehiculos: "Vehiculos",
  viajes: "Viajes",
};

export function SuperadminImportTemplatesPage() {
  const { getToken } = useAuth();
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const moduloParam = searchParams.get("modulo");
  const { showToast } = useToast();
  const iaFileInputRef = useRef<HTMLInputElement>(null);
  const [sugiriendoIA, setSugiriendoIA] = useState(false);
  const [resultadoIA, setResultadoIA] = useState<{
    proveedor: string;
    modelo: string;
    cambios: CambioIA[];
  } | null>(null);

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setTenantLoading(true);
    setTenantError(null);
    (async () => {
      try {
        const t = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(orgId)}`,
          () => getToken(),
        );
        if (!cancelled) setTenant(t);
      } catch (e) {
        if (!cancelled) setTenantError(friendlyError(e, "plataforma"));
      } finally {
        if (!cancelled) setTenantLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, orgId]);

  const {
    templates,
    loading: loadingTpls,
    saving,
    error: tplError,
    save: saveTemplate,
  } = useImportTemplates(orgId ?? "");

  const [tplModulo, setTplModulo] = useState("");
  const [tplNombre, setTplNombre] = useState("");
  const [tplSheet, setTplSheet] = useState("");
  const [tplHeaderRow, setTplHeaderRow] = useState("1");
  const [tplColumnas, setTplColumnas] = useState<EditableColumn[]>([]);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [tplValidationError, setTplValidationError] = useState<string | null>(
    null,
  );

  async function handleModuloChange(m: string) {
    setTplModulo(m);
    setTplNombre(m ? `Template ${labelModulo(m)} — ${tenant?.name ?? ""}` : "");
    setTplColumnas([]);
    setTplValidationError(null);
    setResultadoIA(null);
    if (!m) {
      setTplSheet("");
      setTplHeaderRow("1");
      return;
    }
    // Si ya existe un template guardado para este módulo, precarga sus
    // valores reales en vez de resetear todo a los defaults del catálogo —
    // antes cada vez que se tocaba el selector se perdía la configuración
    // ya guardada (encabezados, obligatorios, "crear si no existe").
    const existente = templates.find((t) => t.modulo === m);
    setTplSheet(
      existente?.config.sheet != null
        ? String(existente.config.sheet)
        : (SHEET_DEFAULT[m] ?? m),
    );
    setTplHeaderRow(
      existente?.config.headerRow != null
        ? String(existente.config.headerRow)
        : "1",
    );
    setLoadingCatalogo(true);
    try {
      const catalogo = await apiJson<CatalogoColumn[]>(
        `/api/importaciones/templates/catalogo?modulo=${encodeURIComponent(m)}`,
        () => getToken(),
      );
      const guardadoPorCampo = new Map(
        (existente?.config.columns ?? []).map((c) => [c.field, c]),
      );
      setTplColumnas(
        catalogo.map((c) => {
          const guardado = guardadoPorCampo.get(c.field);
          return {
            ...c,
            excelHeader:
              guardado?.excelHeader ??
              (existente ? "" : c.defaultExcelHeader),
            required: guardado?.required ?? c.systemRequired,
            defaultValue: guardado?.defaultValue ?? "",
            createIfNotFound: guardado?.createIfNotFound ?? false,
          };
        }),
      );
    } catch {
      setTplValidationError(
        "No se pudo cargar el catálogo de campos de este módulo.",
      );
    } finally {
      setLoadingCatalogo(false);
    }
  }

  async function handleSugerirIA(file: File) {
    if (!tplModulo) return;
    setSugiriendoIA(true);
    setTplValidationError(null);
    setResultadoIA(null);
    // Snapshot de "antes" tal como está el formulario ahora mismo, para
    // poder mostrar qué cambió una vez que llegue la sugerencia.
    const sheetAntes = tplSheet;
    const headerRowAntes = tplHeaderRow;
    const columnasAntes = tplColumnas;
    try {
      const form = new FormData();
      form.append("file", file);
      const sugerencia = await apiJson<SugerenciaTemplate>(
        `/api/importaciones/templates/sugerir?modulo=${encodeURIComponent(tplModulo)}`,
        () => getToken(),
        { method: "POST", body: form },
      );
      const porCampo = new Map(
        sugerencia.columnas.map((c) => [c.field, c.excelHeader]),
      );
      const completados = sugerencia.columnas.filter(
        (c) => c.excelHeader,
      ).length;

      const cambios: CambioIA[] = [];
      if (sugerencia.sheet !== sheetAntes) {
        cambios.push({
          label: "Hoja del Excel",
          antes: sheetAntes || "(vacío)",
          despues: sugerencia.sheet,
        });
      }
      if (String(sugerencia.headerRow) !== headerRowAntes) {
        cambios.push({
          label: "Fila de encabezados",
          antes: headerRowAntes || "(vacío)",
          despues: String(sugerencia.headerRow),
        });
      }
      for (const c of columnasAntes) {
        const sugerido = porCampo.get(c.field);
        if (sugerido && sugerido !== c.excelHeader) {
          cambios.push({
            label: c.campoLabel,
            antes: c.excelHeader || "(vacío)",
            despues: sugerido,
          });
        }
      }

      setTplColumnas((prev) =>
        prev.map((c) => {
          const sugerido = porCampo.get(c.field);
          return sugerido ? { ...c, excelHeader: sugerido } : c;
        }),
      );
      setTplSheet(sugerencia.sheet);
      setTplHeaderRow(String(sugerencia.headerRow));
      setResultadoIA({
        proveedor: sugerencia.proveedor,
        modelo: sugerencia.modelo,
        cambios,
      });
      showToast(
        `Sugerencia de IA aplicada (${sugerencia.proveedor}): hoja "${sugerencia.sheet}", encabezados en la fila ${sugerencia.headerRow}, ${completados} de ${tplColumnas.length} campos completados. Revisá antes de guardar.`,
      );
    } catch (e) {
      setTplValidationError(
        e instanceof Error
          ? e.message
          : "No se pudo generar la sugerencia con IA.",
      );
    } finally {
      setSugiriendoIA(false);
    }
  }

  function updateColumna(field: string, patch: Partial<EditableColumn>) {
    setTplColumnas((prev) =>
      prev.map((c) => (c.field === field ? { ...c, ...patch } : c)),
    );
  }

  function buildConfig() {
    return {
      sheet: tplSheet.trim() || undefined,
      headerRow: Number(tplHeaderRow) || 1,
      columns: tplColumnas
        .filter((c) => c.excelHeader.trim() !== "")
        .map((c) => {
          const col: Record<string, unknown> = {
            excelHeader: c.excelHeader.trim(),
            field: c.field,
            type: c.type,
          };
          if (c.required) col.required = true;
          if (c.type === "lookup") {
            col.lookupModel = c.lookupModel;
            if (c.lookupFields) col.lookupFields = c.lookupFields;
            if (c.createIfNotFound) col.createIfNotFound = true;
            if (c.multiple) {
              col.multiple = true;
              col.separador = c.separador ?? "/";
            }
          }
          if (c.type === "enum" && c.allowedValues) {
            col.allowedValues = c.allowedValues;
          }
          if (c.format) col.format = c.format;
          if (!c.required && c.defaultValue.trim()) {
            col.defaultValue = c.defaultValue.trim();
          }
          if (!c.required && c.warnIfEmpty) col.warnIfEmpty = true;
          return col;
        }),
    };
  }

  function validarTemplate(): string | null {
    if (!tplModulo) return "Elegí un módulo.";
    if (!tplNombre.trim()) return "Ingresá un nombre para el template.";
    const faltanObligatorios = tplColumnas.filter(
      (c) => c.systemRequired && !c.excelHeader.trim(),
    );
    if (faltanObligatorios.length > 0) {
      return `Estos campos los necesita el sistema sí o sí — completá su encabezado de Excel: ${faltanObligatorios
        .map((c) => c.campoLabel)
        .join(", ")}.`;
    }
    const conExcelHeader = tplColumnas.filter((c) => c.excelHeader.trim());
    const headersLower = conExcelHeader.map((c) =>
      c.excelHeader.trim().toLowerCase(),
    );
    const duplicado = headersLower.find(
      (h, i) => headersLower.indexOf(h) !== i,
    );
    if (duplicado) {
      return `Hay más de una columna usando el mismo encabezado de Excel: "${duplicado}".`;
    }
    return null;
  }

  async function handleSaveTemplate() {
    const err = validarTemplate();
    if (err) {
      setTplValidationError(err);
      return;
    }
    setTplValidationError(null);
    const config = buildConfig();
    const ok = await saveTemplate(tplModulo, tplNombre.trim(), JSON.stringify(config));
    if (ok) {
      showToast("Template guardado correctamente.");
    }
  }

  // Clientes/Transportes/Choferes/Vehículos no son módulos vendibles en
  // Tenant.modules — son entidades core del flujo de Viajes, así que se
  // habilitan en bloque junto con él (mismo criterio que el wizard del tenant).
  const modulosDisponibles = (tenant?.modules ?? []).includes("viajes")
    ? ["viajes", "clientes", "transportistas", "choferes", "vehiculos"]
    : [];

  // Si llegamos con ?modulo=X (ej. desde el error de "columnas faltantes"
  // del wizard de import), precarga ese módulo primero. Si no, precarga el
  // primer módulo sin template configurado. En ambos casos, una sola vez
  // que termina de cargar la lista (si el superadmin ya eligió uno, no lo
  // pisa).
  useEffect(() => {
    if (loadingTpls || tplModulo) return;
    if (moduloParam && modulosDisponibles.includes(moduloParam)) {
      void handleModuloChange(moduloParam);
      return;
    }
    const modulosFaltantes = modulosDisponibles.filter(
      (m) => !templates.some((t) => t.modulo === m),
    );
    if (modulosFaltantes.length > 0) {
      void handleModuloChange(modulosFaltantes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingTpls, templates, tplModulo, tenant, moduloParam]);

  return (
    <SuperadminOnly>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
          Configurar templates de importación
        </h1>
        {tenant && <p className="mt-2 text-vialto-steel">{tenant.name}</p>}

        <div className="mt-4">
          <Link
            className="text-sm text-vialto-fire hover:text-vialto-bright"
            to={`/superadmin/empresas/${orgId}/importar`}
          >
            ← Volver a importar
          </Link>
        </div>

        {tenantLoading && (
          <p className="mt-6 text-sm text-vialto-steel">Cargando empresa…</p>
        )}
        {tenantError && <p className="mt-6 text-sm text-red-600">{tenantError}</p>}

        {!tenantLoading && tenant && (
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="max-w-4xl flex-1 space-y-6 border border-black/10 bg-white p-6">
            {loadingTpls && (
              <p className="text-sm text-vialto-steel">Cargando templates…</p>
            )}
            {tplError && (
              <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                {tplError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs uppercase tracking-wider text-vialto-steel">
                  Módulo <span className="text-red-500">*</span>
                </label>
                <select
                  value={tplModulo}
                  onChange={(e) => handleModuloChange(e.target.value)}
                  className="w-full border border-black/25 bg-white px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                >
                  <option value="">Seleccioná un módulo…</option>
                  {modulosDisponibles.map((m) => (
                    <option key={m} value={m}>
                      {labelModulo(m)}
                    </option>
                  ))}
                </select>
              </div>

              {tplModulo && (
                <div className="flex flex-wrap items-center gap-3 border-2 border-vialto-fire/50 bg-vialto-fire/[0.04] px-4 py-3">
                  <input
                    ref={iaFileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleSugerirIA(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => iaFileInputRef.current?.click()}
                    disabled={sugiriendoIA || loadingCatalogo}
                    className="inline-flex h-9 shrink-0 items-center gap-2 px-4 bg-vialto-charcoal text-white text-xs font-semibold uppercase tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sugiriendoIA ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                    )}
                    {sugiriendoIA ? "Analizando con IA…" : "Sugerir con IA"}
                  </button>
                  <span className="min-w-[16rem] flex-1 text-[11px] text-vialto-steel">
                    {sugiriendoIA
                      ? "Analizando el archivo — la hoja, la fila de encabezados y las columnas de abajo se van a completar solas en un momento."
                      : "Subí un Excel de ejemplo del tenant — la IA completa la hoja, la fila de encabezados y el mapeo de columnas de abajo (no guarda nada sola, revisás y guardás vos)."}
                  </span>
                </div>
              )}

              {tplModulo && (
                <div className="grid grid-cols-2 gap-4">
                  <label className="space-y-1">
                    <span className="block text-xs uppercase tracking-wider text-vialto-steel">
                      Hoja del Excel
                    </span>
                    <input
                      value={tplSheet}
                      onChange={(e) => setTplSheet(e.target.value)}
                      placeholder="ej. Clientes"
                      disabled={sugiriendoIA}
                      className={[
                        "w-full border px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal",
                        sugiriendoIA
                          ? "animate-pulse border-vialto-fire bg-vialto-fire/10"
                          : "border-black/25 bg-white",
                      ].join(" ")}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs uppercase tracking-wider text-vialto-steel">
                      Fila de encabezados
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={tplHeaderRow}
                      onChange={(e) => setTplHeaderRow(e.target.value)}
                      disabled={sugiriendoIA}
                      className={[
                        "w-full border px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal",
                        sugiriendoIA
                          ? "animate-pulse border-vialto-fire bg-vialto-fire/10"
                          : "border-black/25 bg-white",
                      ].join(" ")}
                    />
                  </label>
                </div>
              )}

              {tplValidationError && (
                <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {tplValidationError}
                </div>
              )}

              {loadingCatalogo && (
                <p className="text-sm text-vialto-steel">
                  Cargando campos del módulo…
                </p>
              )}

              {!loadingCatalogo && tplColumnas.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">
                      Columnas del Excel
                    </label>
                    <span className="text-[11px] text-vialto-steel">
                      Completá el encabezado tal como aparece en el Excel del
                      cliente. Dejalo vacío para no importar esa columna.
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-black/15">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-vialto-charcoal text-left">
                          <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-white">
                            Campo del sistema
                          </th>
                          <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-white">
                            Encabezado en el Excel
                          </th>
                          <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider text-white">
                            Obligatorio
                          </th>
                          <th className="px-3 py-2.5 font-semibold uppercase tracking-wider text-white">
                            Valor por defecto
                          </th>
                          <th className="px-3 py-2.5 text-center font-semibold uppercase tracking-wider text-white">
                            Crear si no existe
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/10">
                        {tplColumnas.map((c) => (
                          <tr
                            key={c.field}
                            className="odd:bg-white even:bg-vialto-mist/40 hover:bg-vialto-mist"
                          >
                            <td className="px-3 py-2.5 whitespace-nowrap font-medium text-vialto-charcoal">
                              {c.campoLabel}
                              {c.type === "lookup" && (
                                <span className="ml-1 font-normal text-[10px] text-vialto-steel">
                                  ({labelModulo(c.lookupModel ?? "")})
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                value={c.excelHeader}
                                onChange={(e) =>
                                  updateColumna(c.field, {
                                    excelHeader: e.target.value,
                                  })
                                }
                                placeholder="Sin mapear"
                                disabled={sugiriendoIA}
                                className={[
                                  "h-8 w-full min-w-[10rem] border px-2 text-xs text-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal",
                                  sugiriendoIA
                                    ? "animate-pulse border-vialto-fire bg-vialto-fire/10"
                                    : "border-black/25 bg-white",
                                ].join(" ")}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {c.systemRequired ? (
                                <span
                                  className="inline-flex items-center rounded-full bg-vialto-charcoal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                                  title="El sistema siempre necesita este campo"
                                >
                                  Sí
                                </span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={c.required}
                                  onChange={(e) =>
                                    updateColumna(c.field, {
                                      required: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-vialto-charcoal"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {!c.required && c.type !== "lookup" ? (
                                <input
                                  value={c.defaultValue}
                                  onChange={(e) =>
                                    updateColumna(c.field, {
                                      defaultValue: e.target.value,
                                    })
                                  }
                                  placeholder="—"
                                  className="h-8 w-full min-w-[6rem] border border-black/25 bg-white px-2 text-xs text-vialto-charcoal focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                                />
                              ) : (
                                <span className="text-vialto-steel">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {c.createIfNotFoundSoportado ? (
                                <input
                                  type="checkbox"
                                  checked={c.createIfNotFound}
                                  onChange={(e) =>
                                    updateColumna(c.field, {
                                      createIfNotFound: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-vialto-charcoal"
                                />
                              ) : (
                                <span className="text-vialto-steel">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
          <div className="space-y-4 border border-black/10 bg-white p-5">
            <h2 className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-vialto-steel">
              Sugerencia de IA
            </h2>

            {sugiriendoIA && (
              <p className="flex items-center gap-2 text-sm text-vialto-steel">
                <Spinner className="h-3.5 w-3.5" />
                Analizando el archivo…
              </p>
            )}

            {!sugiriendoIA && !resultadoIA && (
              <p className="text-sm text-vialto-steel">
                Todavía no usaste "Sugerir con IA" para este módulo. Cuando
                lo hagas, acá vas a ver qué modelo respondió y qué campos
                completó o cambió (antes → después).
              </p>
            )}

            {!sugiriendoIA && resultadoIA && (
              <>
                <div className="flex items-center gap-2 border border-vialto-fire/40 bg-vialto-fire/[0.06] px-3 py-2 text-xs">
                  <Sparkles
                    className="h-3.5 w-3.5 shrink-0 text-vialto-fire"
                    strokeWidth={1.75}
                  />
                  <span className="text-vialto-charcoal">
                    <strong>{resultadoIA.proveedor}</strong>{" "}
                    <span className="text-vialto-steel">
                      ({resultadoIA.modelo})
                    </span>
                  </span>
                </div>

                {resultadoIA.cambios.length === 0 ? (
                  <p className="text-sm text-vialto-steel">
                    No propuso cambios sobre lo que ya había en el
                    formulario.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-vialto-steel">
                      {resultadoIA.cambios.length} campo
                      {resultadoIA.cambios.length !== 1 ? "s" : ""}{" "}
                      afectado
                      {resultadoIA.cambios.length !== 1 ? "s" : ""}
                    </p>
                    <ul className="divide-y divide-black/10 border border-black/10">
                      {resultadoIA.cambios.map((c, i) => (
                        <li key={i} className="px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-vialto-charcoal">
                            {c.label}
                          </p>
                          <p className="mt-1 text-xs text-vialto-steel line-through decoration-red-400">
                            {c.antes}
                          </p>
                          <p className="text-xs font-medium text-vialto-charcoal">
                            → {c.despues}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border border-black/10 bg-white p-5">
            <button
              type="button"
              disabled={
                !tplModulo ||
                !tplNombre.trim() ||
                loadingCatalogo ||
                tplColumnas.length === 0 ||
                saving
              }
              onClick={handleSaveTemplate}
              className="inline-flex h-10 w-full items-center justify-center gap-2 bg-vialto-charcoal px-5 text-sm uppercase tracking-wider text-white hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? "Guardando…" : "Guardar template"}
            </button>
          </div>
          </aside>
          </div>
        )}
      </div>
    </SuperadminOnly>
  );
}
