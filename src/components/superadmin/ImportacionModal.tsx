import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useToast } from "@/lib/toast";
import { Spinner } from "@/components/ui/Spinner";
import { ListadoCard } from "@/components/listado/ListadoCard";
import {
  ListadoDatos,
  type ListadoColumn,
} from "@/components/listado/ListadoDatos";
import { useImportacion } from "@/hooks/useImportacion";
import { useImportTemplates } from "@/hooks/useImportTemplates";
import { CiudadAdvertenciasPanel } from "@/components/importacion/CiudadAdvertenciasPanel";
import { apiJson } from "@/lib/api";
import { modalOverlayClass } from "@/lib/modalLayers";
import { labelModulo } from "@/lib/platformLabels";
import { listadoTablaTdClass } from "@/lib/listadoTabla";
import type {
  ImportPreviewViaje,
  ImportPreviewFactura,
  ImportPreviewEntidad,
} from "@/types/api";

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
  columnas: Array<{ field: string; excelHeader: string }>;
  headersNoUsados: string[];
};

const SHEET_DEFAULT: Record<string, string> = {
  clientes: "Clientes",
  transportistas: "Transportes",
  choferes: "Choferes",
  vehiculos: "Vehiculos",
  viajes: "Viajes",
};

interface ImportacionModalProps {
  /** Desacoplado de `Tenant` (superadmin) a propósito: una pantalla de admin de
   * tenant no tiene ese objeto completo, solo su propio tenant de sesión. */
  tenantId: string;
  tenantName: string;
  tenantModules: string[];
  onClose: () => void;
}

type MainTab = "importar" | "templates";

export function ImportacionModal({
  tenantId,
  tenantName,
  tenantModules,
  onClose,
}: ImportacionModalProps) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [mainTab, setMainTab] = useState<MainTab>("importar");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iaFileInputRef = useRef<HTMLInputElement>(null);
  const [sugiriendoIA, setSugiriendoIA] = useState(false);

  const importacion = useImportacion(tenantId, () => getToken());
  const {
    templates,
    loading: loadingTpls,
    saving,
    error: tplError,
    save: saveTemplate,
  } = useImportTemplates(tenantId);

  // Template form state
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
    setTplNombre(m ? `Template ${labelModulo(m)} — ${tenantName}` : "");
    setTplColumnas([]);
    setTplValidationError(null);
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
      setTplColumnas((prev) =>
        prev.map((c) => {
          const sugerido = porCampo.get(c.field);
          return sugerido ? { ...c, excelHeader: sugerido } : c;
        }),
      );
      showToast(
        `Sugerencia de IA aplicada: ${completados} de ${tplColumnas.length} campos completados. Revisá antes de guardar.`,
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

  function handleClose() {
    importacion.reset();
    onClose();
  }

  // Clientes/Transportes/Choferes/Vehículos no son módulos vendibles en
  // Tenant.modules — son entidades core del flujo de Viajes, así que se
  // habilitan en bloque junto con él (mismo criterio que el wizard del tenant).
  const modulosDisponibles = tenantModules.includes("viajes")
    ? ["viajes", "clientes", "transportistas", "choferes", "vehiculos"]
    : [];
  const modulosFaltantes = modulosDisponibles.filter(
    (m) => !templates.some((t) => t.modulo === m),
  );

  // Precarga el primer módulo sin template configurado, una sola vez que
  // termina de cargar la lista (si el superadmin ya eligió uno, no lo pisa).
  useEffect(() => {
    if (!loadingTpls && !tplModulo && modulosFaltantes.length > 0) {
      void handleModuloChange(modulosFaltantes[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingTpls, templates, tplModulo]);

  const {
    step,
    modulo,
    setModulo,
    file,
    setFile,
    loading,
    validandoCiudades,
    error,
    preview,
    log,
    submitPreview,
    reintentarPreview,
    confirm,
    elegirCiudad,
    ignorarFila,
    reset,
  } = importacion;

  return (
    <div
      className={modalOverlayClass}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="relative w-full max-w-5xl bg-white shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-vialto-charcoal">
              Importar datos
            </h2>
            <p className="mt-0.5 text-sm text-vialto-steel">{tenantName}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none px-2"
          >
            ✕
          </button>
        </div>

        {/* Main tabs */}
        <div className="flex border-b border-black/10">
          {(["importar", "templates"] as MainTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMainTab(t)}
              className={[
                "px-6 py-2.5 text-xs uppercase tracking-widest font-[family-name:var(--font-ui)] border-b-2 -mb-px transition-colors",
                mainTab === t
                  ? "border-vialto-fire text-vialto-fire"
                  : "border-transparent text-vialto-steel hover:text-vialto-charcoal",
              ].join(" ")}
            >
              {t === "importar" ? "Importar" : "Templates"}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB: IMPORTAR                                         */}
        {/* ══════════════════════════════════════════════════════ */}
        {mainTab === "importar" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {error && (
                <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {/* Step 1 */}
              {step === "upload" && (
                <div className="space-y-5">
                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">
                      Módulo <span className="text-red-500">*</span>
                    </label>
                    {modulosDisponibles.length === 0 ? (
                      <p className="text-sm text-vialto-steel">
                        Esta empresa no tiene módulos con soporte de
                        importación.
                      </p>
                    ) : (
                      <select
                        value={modulo}
                        onChange={(e) => setModulo(e.target.value)}
                        className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                      >
                        <option value="">Seleccioná un módulo…</option>
                        {modulosDisponibles.map((m) => (
                          <option key={m} value={m}>
                            {labelModulo(m)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs uppercase tracking-wider text-vialto-steel">
                      Archivo Excel (.xlsx / .xls){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-black/20 py-8 text-sm text-vialto-steel hover:border-vialto-charcoal hover:text-vialto-charcoal transition-colors"
                    >
                      {file ? (
                        <>
                          <span className="text-2xl">📄</span>
                          <span className="font-medium text-vialto-charcoal">
                            {file.name}
                          </span>
                          <span className="text-xs">
                            {(file.size / 1024).toFixed(0)} KB — clic para
                            cambiar
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl">📂</span>
                          <span>Clic para seleccionar archivo</span>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  {modulo &&
                    templates.length > 0 &&
                    !templates.find((t) => t.modulo === modulo) && (
                      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        No hay template configurado para{" "}
                        <strong>{labelModulo(modulo)}</strong>.{" "}
                        <button
                          type="button"
                          onClick={() => setMainTab("templates")}
                          className="underline"
                        >
                          Creá uno en la pestaña Templates
                        </button>
                        .
                      </div>
                    )}
                </div>
              )}

              {/* Step 2 */}
              {step === "preview" && preview && (
                <PreviewPanel
                  preview={preview}
                  tenantId={tenantId}
                  getToken={getToken}
                  onEntidadesCreadas={reintentarPreview}
                  onElegirCiudad={elegirCiudad}
                  onIgnorarFila={ignorarFila}
                />
              )}

              {/* Step 3 */}
              {step === "result" && log && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    <StatBox label="Total de filas" value={log.totalFilas} />
                    <StatBox
                      label="Importadas"
                      value={log.exitosas}
                      highlight="ok"
                    />
                    <StatBox
                      label="Con errores"
                      value={log.errores}
                      highlight={log.errores > 0 ? "error" : undefined}
                    />
                  </div>
                  <div
                    className={[
                      "rounded px-4 py-3 text-sm",
                      log.estado === "completado"
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "",
                      log.estado === "con_errores"
                        ? "bg-amber-50 border border-amber-200 text-amber-800"
                        : "",
                      log.estado === "fallido"
                        ? "bg-red-50 border border-red-200 text-red-800"
                        : "",
                    ].join(" ")}
                  >
                    {log.estado === "completado" &&
                      `✓ Importación completada — ${log.exitosas} registros creados.`}
                    {log.estado === "con_errores" &&
                      `⚠ Importación parcial — ${log.exitosas} creados, ${log.errores} con error.`}
                    {log.estado === "fallido" &&
                      "✕ La importación falló. No se creó ningún registro."}
                  </div>
                  {log.detalles.some((d) => d.estado === "error") && (
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wider text-vialto-steel">
                        Filas con error
                      </p>
                      <div className="max-h-48 overflow-y-auto rounded border border-red-200 bg-red-50 text-xs divide-y divide-red-100">
                        {log.detalles
                          .filter((d) => d.estado === "error")
                          .map((d, i) => (
                            <div key={i} className="px-3 py-1.5 text-red-800">
                              <span className="font-medium">Fila {d.fila}</span>{" "}
                              — {d.mensaje}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer import */}
            <div className="flex items-center justify-between border-t border-black/10 px-6 py-4 bg-vialto-mist/40">
              <button
                type="button"
                onClick={step === "preview" ? reset : handleClose}
                className="text-sm uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal px-3 py-1.5"
              >
                {step === "preview" ? "Volver" : "Cerrar"}
              </button>
              {step === "upload" && (
                <button
                  type="button"
                  disabled={!modulo || !file || loading}
                  onClick={submitPreview}
                  className="inline-flex h-10 items-center gap-2 px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Spinner className="h-3.5 w-3.5" />}
                  {loading
                    ? validandoCiudades
                      ? "Validando ciudades…"
                      : "Procesando…"
                    : "Ver previsualización"}
                </button>
              )}
              {step === "preview" && preview && (
                <button
                  type="button"
                  disabled={loading || preview.exitosas === 0}
                  onClick={confirm}
                  className="inline-flex h-10 items-center gap-2 px-5 bg-vialto-fire text-white text-sm uppercase tracking-wider hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading && <Spinner className="h-3.5 w-3.5" />}
                  {loading
                    ? "Importando…"
                    : `Confirmar importación (${preview.exitosas} filas)`}
                </button>
              )}
              {step === "result" && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
                >
                  Listo
                </button>
              )}
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* TAB: TEMPLATES                                        */}
        {/* ══════════════════════════════════════════════════════ */}
        {mainTab === "templates" && (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {loadingTpls && (
                <p className="text-sm text-vialto-steel">Cargando templates…</p>
              )}

              {/* Formulario crear/actualizar template */}
              <div>
                <p className="mb-3 text-xs uppercase tracking-wider text-vialto-steel">
                  Actualizar template
                </p>
                {tplError && (
                  <div className="mb-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
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
                      className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
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
                    <div className="grid grid-cols-2 gap-4">
                      <label className="space-y-1">
                        <span className="block text-xs uppercase tracking-wider text-vialto-steel">
                          Hoja del Excel
                        </span>
                        <input
                          value={tplSheet}
                          onChange={(e) => setTplSheet(e.target.value)}
                          placeholder="ej. Clientes"
                          className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
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
                          className="w-full border border-black/20 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                        />
                      </label>
                    </div>
                  )}

                  {tplModulo && (
                    <div className="flex items-center gap-3 rounded border border-dashed border-black/20 px-4 py-3">
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
                        className="inline-flex h-9 items-center gap-2 px-4 border border-vialto-charcoal text-vialto-charcoal text-xs uppercase tracking-wider hover:bg-vialto-charcoal hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {sugiriendoIA && <Spinner className="h-3.5 w-3.5" />}
                        {sugiriendoIA
                          ? "Analizando con IA…"
                          : "Sugerir con IA"}
                      </button>
                      <span className="text-[11px] text-vialto-steel">
                        Subí un Excel de ejemplo del tenant — la IA propone
                        los encabezados de abajo, vos los revisás y guardás
                        (no guarda nada sola).
                      </span>
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
                          Completá el encabezado tal como aparece en el Excel
                          del cliente. Dejalo vacío para no importar esa
                          columna.
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded border border-black/10">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-vialto-mist text-left">
                              <th className="px-3 py-2 font-medium text-vialto-steel">
                                Campo del sistema
                              </th>
                              <th className="px-3 py-2 font-medium text-vialto-steel">
                                Encabezado en el Excel
                              </th>
                              <th className="px-3 py-2 text-center font-medium text-vialto-steel">
                                Obligatorio
                              </th>
                              <th className="px-3 py-2 font-medium text-vialto-steel">
                                Valor por defecto
                              </th>
                              <th className="px-3 py-2 text-center font-medium text-vialto-steel">
                                Crear si no existe
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5">
                            {tplColumnas.map((c) => (
                              <tr key={c.field}>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {c.campoLabel}
                                  {c.type === "lookup" && (
                                    <span className="ml-1 text-[10px] text-vialto-steel">
                                      ({labelModulo(c.lookupModel ?? "")})
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={c.excelHeader}
                                    onChange={(e) =>
                                      updateColumna(c.field, {
                                        excelHeader: e.target.value,
                                      })
                                    }
                                    className="h-8 w-full min-w-[10rem] border border-black/20 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={c.required}
                                    disabled={c.systemRequired}
                                    onChange={(e) =>
                                      updateColumna(c.field, {
                                        required: e.target.checked,
                                      })
                                    }
                                    className="accent-vialto-charcoal disabled:opacity-50"
                                    title={
                                      c.systemRequired
                                        ? "El sistema siempre necesita este campo"
                                        : undefined
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  {!c.required && c.type !== "lookup" ? (
                                    <input
                                      value={c.defaultValue}
                                      onChange={(e) =>
                                        updateColumna(c.field, {
                                          defaultValue: e.target.value,
                                        })
                                      }
                                      placeholder="—"
                                      className="h-8 w-full min-w-[6rem] border border-black/20 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                                    />
                                  ) : (
                                    <span className="text-vialto-steel/60">
                                      —
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {c.createIfNotFoundSoportado ? (
                                    <input
                                      type="checkbox"
                                      checked={c.createIfNotFound}
                                      onChange={(e) =>
                                        updateColumna(c.field, {
                                          createIfNotFound: e.target.checked,
                                        })
                                      }
                                      className="accent-vialto-charcoal"
                                    />
                                  ) : (
                                    <span className="text-vialto-steel/60">
                                      —
                                    </span>
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
            </div>

            {/* Footer templates */}
            <div className="flex items-center justify-between border-t border-black/10 px-6 py-4 bg-vialto-mist/40">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm uppercase tracking-wider text-vialto-steel hover:text-vialto-charcoal px-3 py-1.5"
              >
                Cerrar
              </button>
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
                className="inline-flex h-10 items-center gap-2 px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving && <Spinner className="h-3.5 w-3.5" />}
                {saving ? "Guardando…" : "Guardar template"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "ok" | "error" | "warn";
}) {
  return (
    <div
      className={[
        "rounded border px-4 py-3 text-center",
        highlight === "ok" ? "border-green-200 bg-green-50" : "",
        highlight === "error" && value > 0 ? "border-red-200 bg-red-50" : "",
        highlight === "warn" && value > 0 ? "border-amber-200 bg-amber-50" : "",
        !highlight ||
        ((highlight === "error" || highlight === "warn") && value === 0)
          ? "border-black/10 bg-vialto-mist"
          : "",
      ].join(" ")}
    >
      <p
        className={[
          "text-2xl font-bold",
          highlight === "ok" ? "text-green-700" : "",
          highlight === "error" && value > 0 ? "text-red-700" : "",
          highlight === "warn" && value > 0 ? "text-amber-700" : "",
          !highlight ||
          ((highlight === "error" || highlight === "warn") && value === 0)
            ? "text-vialto-charcoal"
            : "",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-vialto-steel">
        {label}
      </p>
    </div>
  );
}

type PreviewTab = "viajes" | "facturas" | "clientes" | "transportistas";

const TIPOS_VEHICULO = [
  "tractor",
  "semirremolque",
  "camion",
  "utilitario",
  "otro",
];

function PreviewPanel({
  preview,
  tenantId,
  getToken,
  onEntidadesCreadas,
  onElegirCiudad,
  onIgnorarFila,
}: {
  preview: import("@/types/api").ImportPreviewResult;
  tenantId: string;
  getToken: () => Promise<string | null>;
  onEntidadesCreadas: () => void;
  onElegirCiudad: (
    fila: number,
    campo: "origen" | "destino",
    valor: string,
  ) => void;
  onIgnorarFila: (fila: number) => void;
}) {
  const [tab, setTab] = useState<PreviewTab>("viajes");

  const vehiculosFaltantes = preview.entidadesFaltantes.find(
    (e) => e.modelo === "vehiculos",
  );
  const [tiposVehiculo, setTiposVehiculo] = useState<Record<string, string>>(
    {},
  );
  const [creandoVehiculos, setCreandoVehiculos] = useState(false);
  const [errorVehiculos, setErrorVehiculos] = useState<string | null>(null);

  async function handleCrearVehiculos() {
    if (!vehiculosFaltantes) return;
    const items = vehiculosFaltantes.valores.map((v) => ({
      patente: v.valor,
      tipo: tiposVehiculo[v.valor] ?? v.tipoSugerido ?? "",
    }));
    const sinTipo = items.filter((i) => !i.tipo);
    if (sinTipo.length > 0) {
      setErrorVehiculos(
        `Falta elegir el tipo para: ${sinTipo.map((i) => i.patente).join(", ")}.`,
      );
      return;
    }
    setCreandoVehiculos(true);
    setErrorVehiculos(null);
    try {
      const res = await apiJson<{
        creados: number;
        errores: { patente: string; error: string }[];
      }>("/api/importaciones/entidades-faltantes/vehiculos", getToken, {
        method: "POST",
        body: JSON.stringify({ tenantId, items }),
      });
      if (res.errores.length > 0) {
        setErrorVehiculos(
          res.errores.map((e) => `${e.patente}: ${e.error}`).join(" · "),
        );
      }
      if (res.creados > 0) onEntidadesCreadas();
    } catch (e) {
      setErrorVehiculos(
        e instanceof Error ? e.message : "No se pudieron crear los vehículos.",
      );
    } finally {
      setCreandoVehiculos(false);
    }
  }

  const otrasEntidadesFaltantes = preview.entidadesFaltantes.filter(
    (e) => e.modelo !== "vehiculos" && e.valores.length > 0,
  );
  const [creandoModelo, setCreandoModelo] = useState<string | null>(null);
  const [errorEntidades, setErrorEntidades] = useState<
    Record<string, string>
  >({});

  async function handleCrearEntidadesSimple(
    modelo: string,
    valores: string[],
  ) {
    setCreandoModelo(modelo);
    setErrorEntidades((prev) => ({ ...prev, [modelo]: "" }));
    try {
      const res = await apiJson<{
        creados: number;
        errores: { valor: string; error: string }[];
      }>(
        `/api/importaciones/entidades-faltantes/${encodeURIComponent(modelo)}`,
        getToken,
        { method: "POST", body: JSON.stringify({ tenantId, valores }) },
      );
      if (res.errores.length > 0) {
        setErrorEntidades((prev) => ({
          ...prev,
          [modelo]: res.errores.map((e) => `${e.valor}: ${e.error}`).join(" · "),
        }));
      }
      if (res.creados > 0) onEntidadesCreadas();
    } catch (e) {
      setErrorEntidades((prev) => ({
        ...prev,
        [modelo]:
          e instanceof Error
            ? e.message
            : `No se pudieron crear los ${labelModulo(modelo).toLowerCase()}.`,
      }));
    } finally {
      setCreandoModelo(null);
    }
  }

  const hasViajes = (preview.viajes?.length ?? 0) > 0;
  const hasFacturas = (preview.facturas?.length ?? 0) > 0;
  const hasClientes = (preview.clientes?.length ?? 0) > 0;
  const hasTransportistas = (preview.transportistas?.length ?? 0) > 0;
  const advertenciasCiudad = preview.advertenciasCiudad ?? [];
  const totalAdvertenciasCiudad =
    preview.totalAdvertenciasCiudad ?? advertenciasCiudad.length;

  const nuevosClientes = preview.clientes?.filter((c) => c.esNuevo).length ?? 0;
  const nuevosTransp =
    preview.transportistas?.filter((t) => t.esNuevo).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div
        className={`grid gap-2 ${hasViajes ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-4"}`}
      >
        <StatBox label="Filas totales" value={preview.totalFilas} />
        <StatBox
          label="Viajes a crear"
          value={preview.exitosas}
          highlight="ok"
        />
        <StatBox label="Facturas" value={preview.facturas?.length ?? 0} />
        <StatBox
          label="Errores"
          value={preview.errores}
          highlight={preview.errores > 0 ? "error" : undefined}
        />
        {hasViajes && (
          <StatBox
            label="Adv. ciudades"
            value={totalAdvertenciasCiudad}
            highlight={totalAdvertenciasCiudad > 0 ? "warn" : undefined}
          />
        )}
      </div>

      {/* Columnas del Excel sin mapear en el template */}
      {preview.headersNoMapeados.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11px] text-blue-800">
          <span className="mt-0.5 shrink-0 text-base leading-none">ℹ️</span>
          <span>
            El Excel tiene columnas que el template no reconoce — van a
            quedar como texto libre en Observaciones, sin bloquear la
            importación:{" "}
            <strong>{preview.headersNoMapeados.join(", ")}</strong>.
          </span>
        </div>
      )}

      {/* Columnas opcionales del template no encontradas en el Excel */}
      {preview.columnasOpcionalesFaltantes.length > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-100 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
          <span className="mt-0.5 shrink-0 text-base leading-none">⚠️</span>
          <span>
            El template espera estas columnas y no aparecen en el Excel —
            quedan vacías en todas las filas:{" "}
            <strong>{preview.columnasOpcionalesFaltantes.join(", ")}</strong>.
            Si el Excel las llama distinto, ajustá el encabezado desde la
            pestaña Templates.
          </span>
        </div>
      )}

      {/* Vehículos faltantes: crear y reintentar */}
      {vehiculosFaltantes && vehiculosFaltantes.valores.length > 0 && (
        <div className="space-y-2 rounded border border-vialto-charcoal/20 px-4 py-3">
          <p className="text-xs uppercase tracking-wider text-vialto-steel">
            Faltan {vehiculosFaltantes.valores.length} vehículo
            {vehiculosFaltantes.valores.length !== 1 ? "s" : ""}
          </p>
          <p className="text-[11px] text-vialto-steel">
            No existen en el sistema todavía. Elegí el tipo de cada uno y
            creálos — después se vuelve a previsualizar el archivo
            automáticamente.
          </p>
          <div className="overflow-x-auto rounded border border-black/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-vialto-mist text-left">
                  <th className="px-3 py-2 font-medium text-vialto-steel">
                    Patente
                  </th>
                  <th className="px-3 py-2 font-medium text-vialto-steel">
                    Tipo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {vehiculosFaltantes.valores.map((v) => (
                  <tr key={v.valor}>
                    <td className="px-3 py-2 whitespace-nowrap font-mono">
                      {v.valor}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={tiposVehiculo[v.valor] ?? v.tipoSugerido ?? ""}
                        onChange={(e) =>
                          setTiposVehiculo((prev) => ({
                            ...prev,
                            [v.valor]: e.target.value,
                          }))
                        }
                        className="h-8 w-full min-w-[9rem] border border-black/20 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-vialto-charcoal"
                      >
                        <option value="">Elegir…</option>
                        {TIPOS_VEHICULO.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errorVehiculos && (
            <p className="text-xs text-red-700">{errorVehiculos}</p>
          )}
          <button
            type="button"
            onClick={handleCrearVehiculos}
            disabled={creandoVehiculos}
            className="inline-flex h-9 items-center gap-2 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creandoVehiculos && <Spinner className="h-3.5 w-3.5" />}
            {creandoVehiculos
              ? "Creando…"
              : `Crear ${vehiculosFaltantes.valores.length} vehículo${vehiculosFaltantes.valores.length !== 1 ? "s" : ""} y reintentar`}
          </button>
        </div>
      )}

      {/* Otras entidades faltantes (clientes/transportistas/choferes/productos): crear y reintentar */}
      {otrasEntidadesFaltantes.map((grupo) => (
        <div
          key={grupo.modelo}
          className="space-y-2 rounded border border-vialto-charcoal/20 px-4 py-3"
        >
          <p className="text-xs uppercase tracking-wider text-vialto-steel">
            Faltan {grupo.valores.length} {labelModulo(grupo.modelo)}
          </p>
          <p className="text-[11px] text-vialto-steel">
            No existen en el sistema todavía:{" "}
            <strong>{grupo.valores.map((v) => v.valor).join(", ")}</strong>.
            Se crean solo con el nombre — después se vuelve a previsualizar
            el archivo automáticamente.
          </p>
          {errorEntidades[grupo.modelo] && (
            <p className="text-xs text-red-700">
              {errorEntidades[grupo.modelo]}
            </p>
          )}
          <button
            type="button"
            onClick={() =>
              handleCrearEntidadesSimple(
                grupo.modelo,
                grupo.valores.map((v) => v.valor),
              )
            }
            disabled={creandoModelo === grupo.modelo}
            className="inline-flex h-9 items-center gap-2 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creandoModelo === grupo.modelo && (
              <Spinner className="h-3.5 w-3.5" />
            )}
            {creandoModelo === grupo.modelo
              ? "Creando…"
              : `Crear ${grupo.valores.length} ${labelModulo(grupo.modelo).toLowerCase()} y reintentar`}
          </button>
        </div>
      ))}

      {/* Errores */}
      {preview.detalleErrores.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-vialto-steel">
            Errores detectados
          </p>
          <div className="max-h-28 overflow-y-auto rounded border border-red-200 bg-red-50 text-xs divide-y divide-red-100">
            {preview.detalleErrores.map((e, i) => (
              <div key={i} className="px-3 py-1.5 text-red-800">
                <span className="font-medium">Fila {e.fila}</span>
                {e.campo && <span> · {e.campo}</span>} — {e.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advertencias de ciudades: dejan elegir la ciudad correcta */}
      <CiudadAdvertenciasPanel
        advertencias={advertenciasCiudad}
        onElegir={onElegirCiudad}
        onIgnorarFila={onIgnorarFila}
      />

      {preview.exitosas === 0 && (
        <p className="text-sm text-vialto-steel">
          No hay filas válidas. Revisá los errores y corregí el archivo.
        </p>
      )}

      {preview.exitosas > 0 && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-black/10">
            {(
              [
                {
                  key: "viajes",
                  label: `Viajes (${preview.viajes?.length ?? 0})`,
                  show: hasViajes,
                },
                {
                  key: "facturas",
                  label: `Facturas (${preview.facturas?.length ?? 0})`,
                  show: hasFacturas,
                },
                {
                  key: "clientes",
                  label: `Clientes (${preview.clientes?.length ?? 0})${nuevosClientes > 0 ? ` · ${nuevosClientes} nuevos` : ""}`,
                  show: hasClientes,
                },
                {
                  key: "transportistas",
                  label: `Transportistas (${preview.transportistas?.length ?? 0})${nuevosTransp > 0 ? ` · ${nuevosTransp} nuevos` : ""}`,
                  show: hasTransportistas,
                },
              ] as { key: PreviewTab; label: string; show: boolean }[]
            )
              .filter((t) => t.show)
              .map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={[
                    "px-4 py-2 text-[11px] uppercase tracking-wider border-b-2 -mb-px transition-colors",
                    tab === key
                      ? "border-vialto-fire text-vialto-fire"
                      : "border-transparent text-vialto-steel hover:text-vialto-charcoal",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
          </div>

          {tab === "viajes" && hasViajes && (
            <ViajesTable viajes={preview.viajes!} />
          )}
          {tab === "facturas" && hasFacturas && (
            <FacturasTable facturas={preview.facturas!} />
          )}
          {tab === "clientes" && hasClientes && (
            <EntidadTable entidades={preview.clientes!} />
          )}
          {tab === "transportistas" && hasTransportistas && (
            <EntidadTable entidades={preview.transportistas!} />
          )}
        </>
      )}
    </div>
  );
}

function ViajesTable({ viajes }: { viajes: ImportPreviewViaje[] }) {
  const fmt = (v: unknown) => (v != null ? String(v) : "—");
  const money = (v: number | null) =>
    v != null ? `$${v.toLocaleString("es-AR")}` : "—";
  const hasChofer = viajes.some((v) => v.chofer);
  const hasVehiculo = viajes.some((v) => v.vehiculo);

  function advertenciaCampo(
    v: ImportPreviewViaje,
    campo: "origen" | "destino",
  ) {
    return v.advertenciasCiudad?.find((a) => a.campo === campo);
  }

  function celdaUbicacion(v: ImportPreviewViaje, campo: "origen" | "destino") {
    const valor = fmt(v[campo]);
    const adv = advertenciaCampo(v, campo);
    if (!adv) return valor;
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span>{valor}</span>
        <span
          className="text-[10px] font-medium text-amber-700"
          title={adv.mensaje}
        >
          ⚠ {adv.mensaje}
        </span>
      </span>
    );
  }

  const columns: ListadoColumn<ImportPreviewViaje>[] = [
    {
      id: "fila",
      header: "Fila",
      primary: true,
      cell: (v) => v.fila,
      tdClassName: `${listadoTablaTdClass} text-vialto-steel text-xs`,
    },
    { id: "cliente", header: "Cliente", cell: (v) => fmt(v.cliente) },
    { id: "transporte", header: "Transporte", cell: (v) => fmt(v.transporte) },
    {
      id: "origen",
      header: "Origen",
      cell: (v) => celdaUbicacion(v, "origen"),
    },
    {
      id: "destino",
      header: "Destino",
      cell: (v) => celdaUbicacion(v, "destino"),
    },
    ...(hasChofer
      ? [
          {
            id: "chofer",
            header: "Chofer",
            cell: (v: ImportPreviewViaje) => fmt(v.chofer),
          },
        ]
      : []),
    ...(hasVehiculo
      ? [
          {
            id: "vehiculo",
            header: "Vehículo",
            cell: (v: ImportPreviewViaje) => fmt(v.vehiculo),
          },
        ]
      : []),
    { id: "fechaCarga", header: "F. Carga", cell: (v) => fmt(v.fechaCarga) },
    {
      id: "fechaDescarga",
      header: "F. Descarga",
      cell: (v) => fmt(v.fechaDescarga),
    },
    { id: "carga", header: "Carga", cell: (v) => fmt(v.detalleCarga) },
    { id: "monto", header: "Monto", cell: (v) => money(v.monto) },
    { id: "moneda", header: "Moneda", cell: (v) => fmt(v.monedaMonto) },
    { id: "nroFc", header: "Nro FC", cell: (v) => fmt(v.nroFactura) },
    {
      id: "flete",
      header: "Flete",
      cell: (v) => money(v.precioTransportistaExterno),
    },
    {
      id: "monedaFlete",
      header: "Moneda Flete",
      cell: (v) => fmt(v.monedaPrecioTransportistaExterno),
    },
    {
      id: "fcFlete",
      header: "FC Flete",
      cell: (v) => fmt(v.nroFacturaTransporte),
    },
  ];

  return (
    <ListadoDatos
      columns={columns}
      rows={viajes}
      rowKey={(v) => String(v.fila)}
      emptyMessage="No hay viajes en la vista previa."
      renderMobileCard={(v) => {
        const advOrigen = advertenciaCampo(v, "origen");
        const advDestino = advertenciaCampo(v, "destino");
        return (
          <ListadoCard
            primary={`Fila ${v.fila} · ${fmt(v.cliente)}`}
            fields={[
              { label: "Transporte", value: fmt(v.transporte) },
              {
                label: "Origen",
                value: advOrigen ? (
                  <span className="text-amber-700">
                    {fmt(v.origen)} — {advOrigen.mensaje}
                  </span>
                ) : (
                  fmt(v.origen)
                ),
              },
              {
                label: "Destino",
                value: advDestino ? (
                  <span className="text-amber-700">
                    {fmt(v.destino)} — {advDestino.mensaje}
                  </span>
                ) : (
                  fmt(v.destino)
                ),
              },
              ...(hasChofer ? [{ label: "Chofer", value: fmt(v.chofer) }] : []),
              ...(hasVehiculo
                ? [{ label: "Vehículo", value: fmt(v.vehiculo) }]
                : []),
              { label: "F. Carga", value: fmt(v.fechaCarga) },
              { label: "F. Descarga", value: fmt(v.fechaDescarga) },
              { label: "Carga", value: fmt(v.detalleCarga) },
              { label: "Monto", value: money(v.monto) },
              { label: "Moneda", value: fmt(v.monedaMonto) },
              { label: "Nro FC", value: fmt(v.nroFactura) },
              { label: "Flete", value: money(v.precioTransportistaExterno) },
              {
                label: "Moneda Flete",
                value: fmt(v.monedaPrecioTransportistaExterno),
              },
              { label: "FC Flete", value: fmt(v.nroFacturaTransporte) },
            ]}
          />
        );
      }}
    />
  );
}

function FacturasTable({ facturas }: { facturas: ImportPreviewFactura[] }) {
  const tipoBadge = (tipo: ImportPreviewFactura["tipo"]) => (
    <span
      className={[
        "text-[10px] px-1.5 py-0.5 uppercase tracking-wider rounded",
        tipo === "cliente"
          ? "bg-blue-100 text-blue-700"
          : "bg-amber-100 text-amber-700",
      ].join(" ")}
    >
      {tipo === "cliente" ? "Cliente" : "Flete"}
    </span>
  );

  return (
    <ListadoDatos
      columns={[
        {
          id: "tipo",
          header: "Tipo",
          cell: (f) => tipoBadge(f.tipo),
          tdClassName: listadoTablaTdClass,
        },
        {
          id: "numero",
          header: "Número",
          primary: true,
          cell: (f) => f.numero,
        },
        { id: "nombre", header: "Nombre", cell: (f) => f.nombre },
        {
          id: "importe",
          header: "Importe",
          cell: (f) => `$${f.importe.toLocaleString("es-AR")}`,
          tdClassName: `${listadoTablaTdClass} font-medium`,
        },
        { id: "emision", header: "Emisión", cell: (f) => f.fechaEmision },
        {
          id: "vencimiento",
          header: "Vencimiento",
          cell: (f) => f.fechaVencimiento,
        },
      ]}
      rows={facturas}
      rowKey={(f) => `${f.tipo}-${f.numero}`}
      emptyMessage="No hay facturas en la vista previa."
      renderMobileCard={(f) => (
        <ListadoCard
          primary={f.numero}
          fields={[
            { label: "Tipo", value: tipoBadge(f.tipo) },
            { label: "Nombre", value: f.nombre },
            {
              label: "Importe",
              value: `$${f.importe.toLocaleString("es-AR")}`,
            },
            { label: "Emisión", value: f.fechaEmision },
            { label: "Vencimiento", value: f.fechaVencimiento },
          ]}
        />
      )}
    />
  );
}

function EntidadTable({ entidades }: { entidades: ImportPreviewEntidad[] }) {
  return (
    <div className="rounded border border-black/10 divide-y divide-black/5 max-h-80 overflow-y-auto">
      {entidades.map((e, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-4 py-2.5 text-sm"
        >
          <span className="text-vialto-charcoal">{e.nombre}</span>
          {e.esNuevo ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 uppercase tracking-wider">
              Nuevo
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 bg-vialto-mist text-vialto-steel uppercase tracking-wider">
              Existente
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
