import { useAuth } from "@clerk/clerk-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/lib/toast";
import { Check, Download, Upload } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import {
  ViewModalShell,
  viewModalBtnGhost,
} from "@/components/ui/ViewModalShell";
import { labelModulo } from "@/lib/platformLabels";
import { apiJson } from "@/lib/api";
import { modalEditOverlayClass, modalEditPanelClass } from "@/lib/modalLayers";
import {
  metaPaginacionCliente,
  paginasVisibles,
  slicePaginaCliente,
} from "@/lib/listadoPaginacion";
import {
  MODULOS_SECUENCIA,
  useImportWizard,
  type AsignacionHoja,
  type ModuloWizard,
} from "@/hooks/useImportWizard";
import { CiudadAdvertenciasPanel } from "@/components/importacion/CiudadAdvertenciasPanel";
import { ImportAlert } from "@/components/importacion/ImportAlert";
import { descargarPlantillaImportacion } from "@/lib/importacionPlantillaExcelExport";
import { condicionIvaLabel } from "@/lib/arcaCbteTipo";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useMaestroData } from "@/hooks/useMaestroData";
import { useTipoFlotaVisible } from "@/hooks/useTipoFlotaVisible";
import { useTenantPaisFijo } from "@/hooks/useTenantPaisFijo";
import type { PaisCodigo } from "@/lib/ciudades";
import type {
  ImportPreviewViaje,
  ImportPreviewFilaEntidad,
  ImportColumnasEsperadasModulo,
  ImportCampoUnicoConflicto,
} from "@/types/api";

interface ImportWizardProps {
  tenantId: string;
  tenantModules: string[];
  /** Adónde vuelve el botón "Listo" al terminar el wizard. */
  backTo: string;
  /**
   * Listado de Viajes de esta empresa (con `?tenantId=` para superadmin).
   * Si la importación termina sin errores y se importaron viajes, el wizard
   * redirige acá en vez de mostrar el resumen; sin viajes, a `backTo`.
   */
  viajesTo: string;
  /**
   * Base de la URL de configuración de templates (ej.
   * `/superadmin/empresas/:orgId/importar/templates`). Solo el superadmin la
   * tiene — cuando está presente, un error de columnas faltantes ofrece un
   * link directo a corregir el template de ese módulo. El tenant-admin no
   * tiene acceso a esa pantalla, así que en su lugar ve un mensaje para que
   * le pida el ajuste a su administrador.
   */
  templatesTo?: string;
  /** Título de la página: va a la izquierda, en la misma línea que los pasos. */
  encabezado?: ReactNode;
  /** Botones extra a la derecha de "Cambiar archivo" (ej. "Configurar templates" en superadmin). */
  acciones?: ReactNode;
}

const th = "px-3 py-2 text-left font-semibold text-vialto-steel";
const td = "px-3 py-2 border-t border-black/10";

/** Prefijo fijo del mensaje que tira el backend cuando el Excel no tiene las columnas obligatorias del template activo (ver validator.service.ts). */
const PREFIJO_COLUMNAS_FALTANTES = "Faltan columnas obligatorias en el archivo:";

const TIPOS_VEHICULO = [
  "tractor",
  "semirremolque",
  "camion",
  "utilitario",
  "otro",
];

/**
 * Etapas post-viajes ("Liquidaciones a transportistas" / "Facturas a
 * clientes": borradores generados con los viajes recién importados).
 * Ocultas a pedido (oct 2026): nunca se eligen, y las fases
 * `post-liquidaciones`/`post-facturas` del wizard se saltean solas
 * (`AvanceSilencioso`). Toda la lógica sigue; para reactivarlas hay que volver
 * a ofrecer los checks (ver CLAUDE.md, "Importación masiva desde Excel").
 */
const POST_VIAJES_ELEGIDO = { liquidaciones: false, facturas: false } as const;

/**
 * Wizard paso a paso del import. Arranca por el archivo: el backend detecta
 * qué módulos trae (`useImportWizard.startFile`) y la secuencia se arma solo
 * con esos, en orden Clientes → Transportes → Choferes → Vehículos → Viajes.
 * Cada etapa se previsualiza y confirma (o se saltea) por separado — no hay
 * un botón único que confirme todo el archivo de una vez.
 * Compartido entre tenant-admin y superadmin: la única diferencia entre
 * ambos es qué `tenantId`/`tenantModules` se le pasa desde la página que lo
 * hostea.
 */
export function ImportWizard({
  tenantId,
  tenantModules,
  backTo,
  viajesTo,
  templatesTo,
  encabezado,
  acciones,
}: ImportWizardProps) {
  const { getToken } = useAuth();
  const maestro = useMaestroData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const hasFacturasArca = tenantModules.includes("emision-facturas-arca");
  const hasLiquidoProductoArca = tenantModules.includes(
    "emision-liquido-producto-arca",
  );
  const postViajesElegido = POST_VIAJES_ELEGIDO;
  // Empresa solo de flota propia (Tenant.tipoFlota): no tiene transportistas,
  // el paso "Transportes" no se ofrece ni se recorre.
  const { transportistaExternoVisible } = useTipoFlotaVisible(tenantId);
  // País fijo de la empresa: las ciudades a confirmar se buscan solo en ese país.
  const { paisFijo, tenant: tenantEfectivo } = useTenantPaisFijo(tenantId);
  const moduloPermitido = (m: ModuloWizard) =>
    m !== "transportistas" || transportistaExternoVisible;

  // La planilla modelo se pide al hacer clic (no al montar): así el botón no
  // queda deshabilitado esperando una consulta, y siempre refleja la
  // configuración de campos vigente de la empresa.
  const [descargandoPlantilla, setDescargandoPlantilla] = useState(false);
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null);
  // Paso ya completado que el usuario quiere volver a mirar (no navega el
  // wizard hacia atrás, solo abre un resumen de lo que ya pasó en esa etapa
  // — los pasos futuros o el actual no son clickeables).
  const [pasoRevisando, setPasoRevisando] = useState<string | null>(null);

  async function descargarPlanilla() {
    setDescargandoPlantilla(true);
    setErrorPlantilla(null);
    try {
      const data = await apiJson<ImportColumnasEsperadasModulo[]>(
        `/api/importaciones/columnas-esperadas?tenantId=${encodeURIComponent(tenantId)}`,
        getToken,
      );
      descargarPlantillaImportacion(
        data.filter((m) => moduloPermitido(m.modulo as ModuloWizard)),
      );
    } catch {
      setErrorPlantilla("No se pudo generar la planilla. Probá de nuevo.");
    } finally {
      setDescargandoPlantilla(false);
    }
  }

  const wizard = useImportWizard(
    tenantId,
    MODULOS_SECUENCIA.filter(moduloPermitido),
    () => getToken(),
    tenantEfectivo?.recomendacionCiudadesHabilitada !== false,
  );

  // El wizard crea clientes/transportistas/choferes/vehículos por fuera del
  // contexto global de maestros (MaestroDataProvider, en App.tsx) — ese
  // contexto solo se re-fetchea cuando algo llama explícitamente a sus
  // `refresh*`. Sin esto, pantallas que dependen de esas listas cacheadas
  // (ej. la columna "Cliente" de Facturas, que resuelve el nombre buscando
  // en `maestro.clientes` y si no lo encuentra muestra el ID crudo) quedan
  // desactualizadas hasta un F5 después de importar. Se dispara una sola
  // vez al llegar a "terminado" (no en cada módulo, para no spamear
  // requests) y se rearma si se corre el wizard de nuevo.
  const refrescoMaestroHecho = useRef(false);
  useEffect(() => {
    if (wizard.fase === "terminado") {
      if (!refrescoMaestroHecho.current) {
        refrescoMaestroHecho.current = true;
        void maestro.refreshClientes();
        void maestro.refreshTransportistas();
        void maestro.refreshChoferes();
        void maestro.refreshVehiculos();
      }
    } else {
      refrescoMaestroHecho.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.fase]);

  // Importación terminada sin errores: no hay nada que revisar en el resumen,
  // se va directo al listado (Viajes si se importaron viajes) con un toast.
  // Con errores (o si no se importó nada) se queda en el resumen para que se
  // vea el detalle.
  const navigate = useNavigate();
  const { showToast } = useToast();
  useEffect(() => {
    if (wizard.fase !== "terminado") return;
    const etapas = wizard.etapasCompletadas;
    const huboSinCambios = wizard.sinCambiosModulos.size > 0;
    if (etapas.length === 0 && !huboSinCambios) return;
    if (etapas.some((e) => e.log.errores > 0)) return;
    const contar = (pred: (d: (typeof etapas)[number]["log"]["detalles"][number]) => boolean) =>
      etapas.reduce((n, e) => n + e.log.detalles.filter(pred).length, 0);
    const creados = contar((d) => d.estado === "ok" && d.creado === true);
    const actualizados = contar((d) => d.estado === "ok" && d.creado === false);
    showToast(
      creados + actualizados === 0
        ? "Importación completada: todo ya estaba cargado, no hubo cambios"
        : `Importación completada: ${creados} creados · ${actualizados} actualizados`,
      "success",
    );
    const incluyoViajes =
      etapas.some((e) => e.modulo === "viajes") || wizard.sinCambiosModulos.has("viajes");
    navigate(incluyoViajes ? viajesTo : backTo, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.fase]);

  const [numerosPorCliente, setNumerosPorCliente] = useState<
    Record<string, string>
  >({});

  // Si el Excel ya trae número de factura por viaje, esos viajes quedan
  // facturados individualmente al confirmar Viajes — generar facturas
  // consolidadas acá por encima los facturaría de nuevo. Se avisa antes de
  // que el usuario pida el preview, no después.
  const etapaViajes = wizard.etapasCompletadas.find((e) => e.modulo === "viajes");
  const viajesOk =
    etapaViajes?.log.detalles.filter((d) => d.estado === "ok") ?? [];
  const viajesYaFacturados = viajesOk.filter((d) => d.facturado).length;
  const mayoriaYaFacturada =
    viajesOk.length > 0 && viajesYaFacturados / viajesOk.length >= 0.5;

  const columnasFaltantes = wizard.error?.startsWith(
    PREFIJO_COLUMNAS_FALTANTES,
  )
    ? wizard.error.slice(PREFIJO_COLUMNAS_FALTANTES.length).trim()
    : null;
  const moduloLabel = labelModulo(wizard.moduloActual ?? "");

  function reiniciarImportacion() {
    wizard.reset();
    setPasoRevisando(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Una sola línea: título de la página, pasos y acciones. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {encabezado && <div className="shrink-0">{encabezado}</div>}
        <div className="min-w-0 flex-1">
          <WizardStepper
            wizard={wizard}
            postViajesElegido={postViajesElegido}
            onVerPaso={setPasoRevisando}
          />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(wizard.fase !== "upload" || wizard.revision) && (
            <button
              type="button"
              onClick={reiniciarImportacion}
              className="shrink-0 border border-black/15 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-vialto-charcoal shadow-sm hover:bg-vialto-mist"
            >
              Cambiar archivo
            </button>
          )}
          {acciones}
        </div>
      </div>

      {wizard.error && columnasFaltantes && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>
            El Excel no tiene las columnas que el sistema espera para
            importar <strong>{moduloLabel}</strong>: {columnasFaltantes}.
          </p>
          {templatesTo ? (
            <>
              <p className="mt-1">
                Corregí el mapeo de encabezados en el template de este
                módulo.
              </p>
              <Link
                to={`${templatesTo}?modulo=${encodeURIComponent(wizard.moduloActual ?? "")}`}
                className="mt-2 inline-block text-sm font-semibold text-vialto-fire hover:text-vialto-bright"
              >
                Ir a configurar el template de {moduloLabel} →
              </Link>
            </>
          ) : (
            <p className="mt-1">
              Pedile a tu administrador que configure el sistema para que
              reconozca los encabezados de este Excel, o agregá al archivo
              columnas con esos nombres.
            </p>
          )}
          {!wizard.preview && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reiniciarImportacion}
                className="border border-red-300 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-red-800 hover:bg-red-100"
              >
                Volver a importar
              </button>
              {wizard.fase === "modulo" && (
                <button
                  type="button"
                  disabled={wizard.loading}
                  onClick={wizard.saltearModuloActual}
                  className="border border-red-300 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  No importar {moduloLabel} y seguir
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {wizard.error && !columnasFaltantes && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{wizard.error}</p>
          {!wizard.preview && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reiniciarImportacion}
                className="border border-red-300 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-red-800 hover:bg-red-100"
              >
                Volver a importar
              </button>
              {wizard.fase === "modulo" && (
                <button
                  type="button"
                  disabled={wizard.loading}
                  onClick={wizard.saltearModuloActual}
                  className="border border-red-300 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                  No importar {moduloLabel} y seguir
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!(wizard.error && !wizard.preview) && (
        <div className="border border-black/10 bg-white p-6">
          {wizard.fase === "upload" && (
            <div className="flex flex-col gap-4">
              {wizard.revision ? (
                <RevisionArchivo
                  revision={wizard.revision}
                  nombreArchivo={wizard.file?.name ?? ""}
                  loading={wizard.loading}
                  onContinuar={(asignaciones) =>
                    void wizard.iniciarImportacion(asignaciones)
                  }
                  onCambiarArchivo={reiniciarImportacion}
                />
              ) : (
              <>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastrando(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) wizard.startFile(f);
                }}
                className={[
                  "flex w-full cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed py-16 transition-colors",
                  arrastrando
                    ? "border-vialto-charcoal bg-vialto-mist text-vialto-charcoal"
                    : "border-black/20 text-vialto-steel hover:border-vialto-charcoal hover:text-vialto-charcoal",
                  wizard.loading ? "pointer-events-none bg-vialto-blue/5 border-vialto-blue/50" : "",
                ].join(" ")}
              >
                {wizard.loading ? (
                  <>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-vialto-charcoal border-t-transparent" />
                    <span className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-wider text-vialto-charcoal">
                      Leyendo el archivo…
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" strokeWidth={1.5} />
                    <span className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-wider text-vialto-charcoal">
                      Arrastrá el archivo o hacé clic para seleccionarlo
                    </span>
                    <span className="text-xs">
                      .xlsx o .xls — detectamos solos qué hojas trae (clientes,
                      transportes, choferes, vehículos, viajes)
                    </span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) wizard.startFile(f);
                }}
                className="hidden"
              />
              <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    disabled={descargandoPlantilla}
                    onClick={() => void descargarPlanilla()}
                    className="inline-flex items-center gap-2 border border-black/15 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                  >
                    {descargandoPlantilla ? (
                      <Spinner className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    )}
                    {descargandoPlantilla ? "Generando…" : "Descargar planilla"}
                  </button>
                  {errorPlantilla && (
                    <p className="text-xs font-medium text-red-600">{errorPlantilla}</p>
                  )}
              </div>
              </>
              )}
            </div>
          )}

          {wizard.fase === "modulo" && wizard.moduloActual && (
            <EtapaModulo wizard={wizard} paisFijo={paisFijo} />
          )}

          {wizard.fase === "post-liquidaciones" && postViajesElegido.liquidaciones && (
            <div className="flex flex-col gap-4">
              {wizard.liquidacionesOmitidasUsdCount > 0 && (wizard.liquidacionesPreview?.length ?? 0) > 0 && (
                <ImportAlert
                  color="amber"
                  collapsible={false}
                  title={
                    <>
                      Se omitió la liquidación de <strong>{wizard.liquidacionesOmitidasUsdCount}</strong> viaje(s) en USD.
                    </>
                  }
                  subtitle="Líquido Producto (ARCA) solo admite comprobantes en pesos."
                />
              )}
              <EtapaOpcional
                titulo="Generar liquidaciones borrador"
                descripcion={
                  hasLiquidoProductoArca
                    ? "Se van a agrupar los viajes por transportista. Quedan en estado BORRADOR."
                    : "Se van a agrupar los viajes por transportista y moneda. Quedan en estado BORRADOR."
                }
                loading={wizard.loading}
                preview={wizard.liquidacionesPreview}
                onPedirPreview={wizard.pedirPreviewLiquidaciones}
                onSaltear={wizard.saltearLiquidaciones}
                onConfirmar={wizard.confirmarLiquidaciones}
                onReiniciar={reiniciarImportacion}
                renderTabla={(items: typeof wizard.liquidacionesPreview) =>
                  items && items.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={th}>Transportista</th>
                          <th className={th}>Viajes</th>
                          <th className={th}>Período</th>
                          {!hasLiquidoProductoArca && <th className={th}>Moneda</th>}
                          <th className={th}>Bruto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((g) => (
                          <tr key={`${g.transportistaId}-${g.moneda || "ARS"}`}>
                            <td className={td}>{g.transportistaNombre}</td>
                            <td className={td}>{g.cantidadViajes}</td>
                            <td className={td}>
                              {g.periodoDesde} — {g.periodoHasta}
                            </td>
                            {!hasLiquidoProductoArca && (
                              <td className={td}>
                                <span className="inline-flex items-center rounded-full bg-vialto-mist border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-vialto-charcoal">
                                  {g.moneda || "ARS"}
                                </span>
                              </td>
                            )}
                            <td className={td}>
                              {g.bruto.toLocaleString("es-AR", {
                                style: "currency",
                                currency: g.moneda || "ARS",
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-vialto-steel">
                      {hasLiquidoProductoArca && wizard.liquidacionesOmitidasUsdCount > 0
                        ? "No hay viajes en pesos para liquidar. La emisión de liquidaciones por ARCA (Líquido Producto) solo admite comprobantes en ARS."
                        : "No hay viajes con transportista externo para liquidar."}
                    </p>
                  )
                }
              />
            </div>
          )}
          {wizard.fase === "post-liquidaciones" && !postViajesElegido.liquidaciones && (
            <AvanceSilencioso onNext={wizard.saltearLiquidaciones} />
          )}

          {wizard.fase === "post-facturas" && postViajesElegido.facturas && (
            <div className="flex flex-col gap-4">
              {mayoriaYaFacturada && (
                <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <strong>
                    {viajesYaFacturados} de {viajesOk.length}
                  </strong>{" "}
                  viajes recién creados ya tienen una factura individual (traían
                  número de factura en el Excel). Si generás facturas
                  consolidadas acá también, esos viajes quedarían facturados dos
                  veces. Si tu Excel ya factura por viaje, probablemente
                  convenga apretar "No, gracias" abajo.
                </div>
              )}
              {wizard.facturasOmitidasUsdCount > 0 && (wizard.facturasPreview?.length ?? 0) > 0 && (
                <ImportAlert
                  color="amber"
                  collapsible={false}
                  title={
                    <>
                      Se omitió la facturación de <strong>{wizard.facturasOmitidasUsdCount}</strong> viaje(s) en USD.
                    </>
                  }
                  subtitle="La emisión por ARCA solo admite comprobantes en pesos."
                />
              )}
              <EtapaOpcional
                titulo="Facturar a clientes"
                descripcion={
                  hasFacturasArca
                    ? "Se van a agrupar los viajes por cliente."
                    : "Se van a agrupar los viajes por cliente y moneda."
                }
                loading={wizard.loading}
                preview={wizard.facturasPreview}
                onPedirPreview={wizard.pedirPreviewFacturas}
                onSaltear={wizard.saltearFacturas}
                onConfirmar={() =>
                  wizard.confirmarFacturas(
                    hasFacturasArca ? undefined : numerosPorCliente,
                  )
                }
                onReiniciar={reiniciarImportacion}
                confirmDisabled={
                  !hasFacturasArca &&
                  (wizard.facturasPreview?.some(
                    (g) =>
                      !numerosPorCliente[`${g.clienteId}|${g.moneda}`]?.trim() &&
                      !numerosPorCliente[g.clienteId]?.trim(),
                  ) ??
                    false)
                }
                renderTabla={(items: typeof wizard.facturasPreview) =>
                  items && items.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={th}>Cliente</th>
                          <th className={th}>Viajes</th>
                          {!hasFacturasArca && <th className={th}>Moneda</th>}
                          <th className={th}>Importe</th>
                          {!hasFacturasArca && <th className={th}>N° de factura</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((g) => {
                          const key = `${g.clienteId}|${g.moneda || "ARS"}`;
                          return (
                            <tr key={key}>
                              <td className={td}>{g.clienteNombre}</td>
                              <td className={td}>{g.cantidadViajes}</td>
                              {!hasFacturasArca && (
                                <td className={td}>
                                  <span className="inline-flex items-center rounded-full bg-vialto-mist border border-black/10 px-2 py-0.5 text-[11px] font-semibold text-vialto-charcoal">
                                    {g.moneda || "ARS"}
                                  </span>
                                </td>
                              )}
                              <td className={td}>
                                {g.importe.toLocaleString("es-AR", {
                                  style: "currency",
                                  currency: g.moneda || "ARS",
                                })}
                              </td>
                              {!hasFacturasArca && (
                                <td className={td}>
                                  <input
                                    type="text"
                                    value={
                                      numerosPorCliente[key] ??
                                      numerosPorCliente[g.clienteId] ??
                                      ""
                                    }
                                    onChange={(e) =>
                                      setNumerosPorCliente((prev) => ({
                                        ...prev,
                                        [key]: e.target.value,
                                        [g.clienteId]: e.target.value,
                                      }))
                                    }
                                    placeholder="0001-00000001"
                                    className="w-full rounded border border-black/15 bg-white px-2 py-1 text-xs"
                                  />
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-vialto-steel">
                      {hasFacturasArca && wizard.facturasOmitidasUsdCount > 0
                        ? "No hay viajes en pesos para facturar. La emisión de facturas por ARCA solo admite comprobantes en ARS."
                        : "No hay viajes con clientes para facturar."}
                    </p>
                  )
                }
              />
            </div>
          )}
          {wizard.fase === "post-facturas" && !postViajesElegido.facturas && (
            <AvanceSilencioso onNext={wizard.saltearFacturas} />
          )}

          {wizard.fase === "terminado" && (
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
                  Resumen de la importación
                </h3>
                <p className="mt-1 text-sm text-vialto-steel">
                  {wizard.etapasCompletadas.length === 0 &&
                    !wizard.liquidacionesCreadas &&
                    !wizard.facturasCreadas
                    ? "No se importó nada, se saltearon todos los módulos."
                    : "Cada módulo ya quedó guardado al confirmarlo — esto es solo un repaso de lo que se hizo."}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                {wizard.etapasCompletadas.length === 0 &&
                  !wizard.liquidacionesCreadas &&
                  !wizard.facturasCreadas && (
                    <p className="border border-black/10 bg-vialto-mist/40 px-4 py-3 text-sm text-vialto-steel">
                      No se guardó ningún dato en esta corrida.
                    </p>
                  )}
                {wizard.etapasCompletadas.map((e) => {
                  const creados = e.log.detalles.filter(
                    (d) => d.estado === "ok" && d.creado,
                  ).length;
                  const actualizados = e.log.detalles.filter(
                    (d) => d.estado === "ok" && d.creado === false,
                  ).length;
                  const erroresDetalle = e.log.detalles.filter(
                    (d) => d.estado === "error",
                  );
                  return (
                    <div
                      key={e.modulo}
                      className={[
                        "border-l-4 bg-vialto-mist/40 px-4 py-3",
                        e.log.errores > 0 ? "border-l-amber-400" : "border-l-green-500",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <p className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                          {labelModulo(e.modulo)}
                        </p>
                        <p className="text-xs text-vialto-steel">
                          <span className="text-green-700 font-medium">
                            {creados} creados
                          </span>
                          {" · "}
                          <span className="text-vialto-charcoal font-medium">
                            {actualizados} actualizados
                          </span>
                          {e.log.errores > 0 && (
                            <>
                              {" · "}
                              <span className="text-amber-700 font-medium">
                                {e.log.errores} con error
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {erroresDetalle.length > 0 && (
                        <details className="group mt-2">
                          <summary className="cursor-pointer list-none text-[11px] text-amber-800 marker:hidden">
                            Ver detalle de errores
                            <span className="ml-1 inline-block transition-transform group-open:rotate-180">
                              ▾
                            </span>
                          </summary>
                          <div className="mt-2 max-h-40 overflow-y-auto border border-amber-100 bg-white text-xs">
                            {erroresDetalle.map((d, i) => (
                              <div
                                key={i}
                                className="border-b border-amber-50 px-3 py-1.5 last:border-b-0"
                              >
                                <span className="font-medium text-vialto-charcoal">
                                  Fila {d.fila}
                                </span>{" "}
                                <span className="text-vialto-steel">
                                  — {d.mensaje}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })}

                {wizard.liquidacionesCreadas && (
                  <div className="border-l-4 border-l-green-500 bg-vialto-mist/40 px-4 py-3">
                    <p className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                      Liquidaciones borrador
                    </p>
                    <p className="text-xs text-vialto-steel">
                      {wizard.liquidacionesCreadas.length} generadas
                    </p>
                  </div>
                )}
                {wizard.facturasCreadas && (
                  <div className="border-l-4 border-l-green-500 bg-vialto-mist/40 px-4 py-3">
                    <p className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                      Facturas
                    </p>
                    <p className="text-xs text-vialto-steel">
                      {wizard.facturasCreadas.length} generadas
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={reiniciarImportacion}
                  className="self-start border border-black/15 bg-white px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-charcoal hover:bg-vialto-mist"
                >
                  Volver a importar
                </button>
                <Link
                  to={backTo}
                  className="self-start border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
                >
                  Listo
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
      {pasoRevisando && (
        <ResumenPasoModal
          paso={pasoRevisando}
          wizard={wizard}
          onClose={() => setPasoRevisando(null)}
        />
      )}
    </div>
  );
}

/**
 * Revisión del archivo cuando la detección no pudo resolver todo sola: hojas
 * con columnas obligatorias faltantes (no se importan), hojas que encajan en
 * más de un módulo (elige el usuario) y hojas que no se parecen a ninguno.
 */
function RevisionArchivo({
  revision,
  nombreArchivo,
  loading,
  onContinuar,
  onCambiarArchivo,
}: {
  revision: NonNullable<ReturnType<typeof useImportWizard>["revision"]>;
  nombreArchivo: string;
  loading: boolean;
  onContinuar: (asignaciones: AsignacionHoja[]) => void;
  onCambiarArchivo: () => void;
}) {
  // hoja → módulo elegido ("" = sin elegir, "no" = no importar)
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  const { listas, conFaltantes, ambiguas, noReconocidas } = revision;

  const elegidas: AsignacionHoja[] = ambiguas
    .filter((a) => eleccion[a.hoja] && eleccion[a.hoja] !== "no")
    .map((a) => ({
      modulo: eleccion[a.hoja] as ModuloWizard,
      hoja: a.hoja,
      filas: a.filas,
    }));
  const asignaciones = [...listas, ...elegidas];
  const faltaElegir = ambiguas.some((a) => !eleccion[a.hoja]);
  const nadaParaImportar = listas.length === 0 && ambiguas.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 text-sm">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-wider text-vialto-charcoal">
        Revisá el archivo{nombreArchivo ? ` «${nombreArchivo}»` : ""}
      </h3>

      {nadaParaImportar && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          No encontramos nada para importar en este archivo. Tiene que tener
          hojas de Clientes, Transportes, Choferes, Vehículos o Viajes con sus
          columnas obligatorias — podés bajar la planilla modelo con
          &quot;Descargar planilla&quot;.
        </div>
      )}

      {listas.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-vialto-steel">
            Se va a importar
          </p>
          <ul className="mt-1.5 divide-y divide-black/10 border border-black/10 bg-white">
            {listas.map((l) => (
              <li key={l.modulo} className="flex justify-between gap-3 px-4 py-2">
                <span className="font-semibold text-vialto-charcoal">
                  {labelModulo(l.modulo)}
                </span>
                <span className="text-vialto-steel">
                  hoja «{l.hoja}» · {l.filas} fila{l.filas !== 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ambiguas.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-vialto-steel">
            ¿Qué tiene cada una de estas hojas?
          </p>
          <ul className="mt-1.5 divide-y divide-black/10 border border-black/10 bg-white">
            {ambiguas.map((a) => {
              const tomados = new Set<string>([
                ...listas.map((l) => l.modulo),
                ...Object.entries(eleccion)
                  .filter(([hoja]) => hoja !== a.hoja)
                  .map(([, m]) => m),
              ]);
              return (
                <li key={a.hoja} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                  <span className="text-vialto-charcoal">
                    Hoja «{a.hoja}» · {a.filas} fila{a.filas !== 1 ? "s" : ""}
                  </span>
                  <select
                    value={eleccion[a.hoja] ?? ""}
                    onChange={(e) =>
                      setEleccion((prev) => ({ ...prev, [a.hoja]: e.target.value }))
                    }
                    className="h-9 border border-black/15 bg-white px-2 text-sm"
                    aria-label={`Qué contiene la hoja ${a.hoja}`}
                  >
                    <option value="">Elegí…</option>
                    {a.candidatos.map((m) => (
                      <option key={m} value={m} disabled={tomados.has(m)}>
                        {labelModulo(m)}
                      </option>
                    ))}
                    <option value="no">No importar</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {conFaltantes.length > 0 && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-red-800">
          <p>
            Estas hojas no se pueden importar porque les faltan columnas
            obligatorias. Corregí el Excel y volvé a subirlo, o seguí sin ellas:
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {conFaltantes.map((h) => (
              <li key={h.modulo}>
                <strong>{labelModulo(h.modulo)}</strong> (hoja «{h.hoja}»):
                faltan {h.faltantes.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {noReconocidas.length > 0 && (
        <p className="text-xs text-vialto-steel">
          No reconocimos {noReconocidas.length === 1 ? "la hoja" : "las hojas"}{" "}
          {noReconocidas.map((h) => `«${h.hoja}»`).join(", ")} — no se{" "}
          {noReconocidas.length === 1 ? "va" : "van"} a importar.
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCambiarArchivo}
          className="border border-black/15 bg-white px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-charcoal hover:bg-vialto-mist"
        >
          Elegir otro archivo
        </button>
        {!nadaParaImportar && (
          <button
            type="button"
            disabled={loading || faltaElegir || asignaciones.length === 0}
            onClick={() => onContinuar(asignaciones)}
            className="border border-black/15 bg-vialto-charcoal px-6 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
          >
            Continuar →
          </button>
        )}
      </div>
    </div>
  );
}

type EstadoPaso = "done" | "current" | "pending" | "omitido";

function WizardStepper({
  wizard,
  postViajesElegido,
  onVerPaso,
}: {
  wizard: ReturnType<typeof useImportWizard>;
  postViajesElegido: { liquidaciones: boolean; facturas: boolean };
  /** Se llama solo al clickear un paso ya completado ("done") — abre un resumen de solo lectura, no navega el wizard. */
  onVerPaso: (paso: string) => void;
}) {
  // Liquidaciones (y el resto de las etapas opcionales post-viajes) solo son
  // alcanzables si "viajes" está en la secuencia de este import — sin viajes,
  // useImportWizard salta directo a "terminado" (ver avanzarModulo). Mostrar
  // el paso igual, aunque nunca se vaya a visitar, confunde al usuario.
  const tieneViajes = wizard.secuencia.includes("viajes");
  const ofreceLiquidaciones = tieneViajes && postViajesElegido.liquidaciones;
  const ofreceFacturas = tieneViajes && postViajesElegido.facturas;
  const enModulos = wizard.fase === "modulo";
  const pasadosModulos = !enModulos && wizard.fase !== "upload";
  const confirmados = new Set(wizard.etapasCompletadas.map((e) => e.modulo));

  const estadoModulo = (m: ModuloWizard): EstadoPaso => {
    if (wizard.omitidos.has(m)) return "omitido";
    const idx = wizard.secuencia.indexOf(m);
    const yaPaso = pasadosModulos || (enModulos && idx < wizard.moduloIndex);
    // Salteado en su paso = omitido; pasado con "Continuar" porque no había
    // cambios = hecho.
    if (yaPaso)
      return confirmados.has(m) || wizard.sinCambiosModulos.has(m) ? "done" : "omitido";
    return enModulos && idx === wizard.moduloIndex ? "current" : "pending";
  };
  const estadoPost = (fase: string, despuesDe: string[]): EstadoPaso =>
    wizard.fase === fase
      ? "current"
      : despuesDe.includes(wizard.fase)
        ? "done"
        : "pending";

  const pasos: { key: string; label: string; estado: EstadoPaso; modulo?: ModuloWizard }[] = [
    // Paso 0: subir el archivo (y revisar lo que se detectó).
    {
      key: "archivo",
      label: "Archivo",
      estado: wizard.fase === "upload" ? "current" : "done",
    },
    ...wizard.detectados.map((d) => ({
      key: d.modulo as string,
      label: labelModulo(d.modulo),
      estado: estadoModulo(d.modulo),
      modulo: d.modulo,
    })),
    ...(ofreceLiquidaciones
      ? [{
          key: "post-liquidaciones",
          label: "Liquidaciones",
          estado: estadoPost("post-liquidaciones", ["post-facturas", "terminado"]),
        }]
      : []),
    ...(ofreceFacturas
      ? [{
          key: "post-facturas",
          label: "Facturas",
          estado: estadoPost("post-facturas", ["terminado"]),
        }]
      : []),
    // Sin paso "Resumen": al terminar sin errores el wizard redirige solo; con
    // errores muestra el resumen, pero no como un paso más del stepper.
  ];

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {pasos.map((p, i) => {
        const esActual = p.estado === "current";
        const burbuja = (
          <span className="relative flex shrink-0 items-center justify-center">
            {/* Paso actual: halo que late detrás de la burbuja. */}
            {esActual && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-vialto-fire/40 motion-safe:animate-ping"
              />
            )}
            <span
              className={[
                "relative flex shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-ui)] font-semibold",
                esActual ? "h-8 w-8 text-sm" : "h-6 w-6 text-[11px]",
                p.estado === "done" ? "bg-vialto-charcoal text-white" : "",
                esActual ? "bg-vialto-fire text-white" : "",
                p.estado === "pending" ? "border border-black/15 text-vialto-steel" : "",
                p.estado === "omitido" ? "border border-dashed border-black/20 text-vialto-steel/60" : "",
              ].join(" ")}
            >
              {p.estado === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
          </span>
        );
        const etiqueta = (clase: string) => (
          <span
            className={`font-[family-name:var(--font-ui)] uppercase tracking-wider ${esActual ? "text-[15px]" : "text-[11px]"} ${clase}`}
          >
            {p.label}
          </span>
        );
        // Un módulo que todavía no empezó se puede marcar "no importar" (y
        // volver a incluir) sin esperar a su vista previa.
        const alternable =
          p.modulo != null &&
          (p.estado === "pending" ||
            (p.estado === "omitido" && wizard.omitidos.has(p.modulo)));
        return (
          <li key={p.key} className="flex items-center gap-1.5">
            {p.estado === "done" ? (
              <button
                type="button"
                onClick={() => onVerPaso(p.key)}
                className="flex items-center gap-1.5 rounded hover:opacity-75"
                title={`Ver resumen de ${p.label}`}
              >
                {burbuja}
                {etiqueta("text-vialto-steel underline decoration-dotted underline-offset-2")}
              </button>
            ) : alternable ? (
              <button
                type="button"
                disabled={wizard.loading}
                onClick={() => wizard.omitirModulo(p.modulo!, p.estado !== "omitido")}
                className="group flex items-center gap-1.5 rounded hover:opacity-75 disabled:cursor-not-allowed"
                title={
                  p.estado === "omitido"
                    ? `${p.label}: no se va a importar. Click para volver a incluirla.`
                    : `Click para no importar ${p.label}`
                }
              >
                {burbuja}
                {etiqueta(
                  p.estado === "omitido"
                    ? "text-vialto-steel/60 line-through"
                    : "text-vialto-steel group-hover:line-through",
                )}
              </button>
            ) : (
              <>
                {burbuja}
                {etiqueta(
                  p.estado === "current"
                    ? "text-vialto-charcoal font-semibold"
                    : p.estado === "omitido"
                      ? "text-vialto-steel/60 line-through"
                      : "text-vialto-steel",
                )}
              </>
            )}
            {i < pasos.length - 1 && (
              <span className="mx-1 text-black/15">—</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Resumen de solo lectura de un paso ya completado — no vuelve a llamar al
 * backend ni cambia el estado del wizard, solo muestra lo que ya se guardó
 * en `etapasCompletadas`/`liquidacionesCreadas`/`facturasCreadas` (o, para
 * "seleccion", lo que se tildó en la pantalla de checks). Volver a ese paso
 * de verdad (para corregirlo) no es seguro una vez que hay pasos
 * posteriores ya confirmados en la base — por eso esto es una foto, no una
 * navegación real.
 */
function ResumenPasoModal({
  paso,
  wizard,
  onClose,
}: {
  paso: string;
  wizard: ReturnType<typeof useImportWizard>;
  onClose: () => void;
}) {
  const titulo =
    paso === "archivo"
      ? "Archivo"
      : paso === "post-liquidaciones"
        ? "Liquidaciones"
        : paso === "post-facturas"
          ? "Facturas"
          : labelModulo(paso);

  let contenido: React.ReactNode;

  if (paso === "archivo") {
    contenido = (
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-vialto-steel">
            Archivo
          </p>
          <p className="mt-1">{wizard.file?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-vialto-steel">
            Hojas detectadas
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {wizard.detectados.map((d) => (
              <li key={d.modulo}>
                {labelModulo(d.modulo)}: hoja «{d.hoja}» · {d.filas} fila
                {d.filas !== 1 ? "s" : ""}
                {wizard.omitidos.has(d.modulo) ? " — no se importa" : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  } else if (paso === "post-liquidaciones") {
    contenido = wizard.liquidacionesCreadas ? (
      <p className="text-sm">
        {wizard.liquidacionesCreadas.length} liquidaciones borrador generadas.
      </p>
    ) : (
      <p className="text-sm text-vialto-steel">Este paso se salteó.</p>
    );
  } else if (paso === "post-facturas") {
    contenido = wizard.facturasCreadas ? (
      <p className="text-sm">
        {wizard.facturasCreadas.length} facturas borrador generadas.
      </p>
    ) : (
      <p className="text-sm text-vialto-steel">Este paso se salteó.</p>
    );
  } else {
    const etapa = wizard.etapasCompletadas.find((e) => e.modulo === paso);
    if (!etapa) {
      contenido = (
        <p className="text-sm text-vialto-steel">
          {wizard.sinCambiosModulos.has(paso as ModuloWizard)
            ? "Todas las filas ya estaban cargadas igual — no hubo nada que guardar."
            : "Este módulo se salteó, no se importó nada."}
        </p>
      );
    } else {
      const { log } = etapa;
      const nuevas = log.detalles.filter(
        (d) => d.estado === "ok" && d.creado,
      ).length;
      const actualizadas = log.detalles.filter(
        (d) => d.estado === "ok" && !d.creado,
      ).length;
      const errores = log.detalles.filter((d) => d.estado === "error");
      contenido = (
        <div className="flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Filas en el Excel" value={log.totalFilas} />
            <StatBox label="Nuevas" value={nuevas} highlight="ok" />
            <StatBox label="Actualizadas" value={actualizadas} />
            <StatBox label="Con error" value={errores.length} highlight="error" />
          </div>
          {errores.length > 0 && (
            <div className="max-h-52 overflow-y-auto border border-black/10">
              {errores.map((d, i) => (
                <div
                  key={i}
                  className="border-b border-black/10 px-3 py-1.5 text-xs last:border-b-0"
                >
                  <span className="font-medium text-vialto-charcoal">
                    Fila {d.fila}
                  </span>{" "}
                  <span className="text-vialto-steel">— {d.mensaje}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <ViewModalShell
      title={`Resumen — ${titulo}`}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={viewModalBtnGhost}>
          Cerrar
        </button>
      }
    >
      {contenido}
    </ViewModalShell>
  );
}

function StatBox({
  label,
  value,
  highlight,
  caption,
}: {
  label: string;
  value: number;
  highlight?: "ok" | "error" | "warn";
  /** Línea chica opcional debajo del label, ej. desglose "N nuevas · N a actualizar". */
  caption?: string;
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
      {caption && (
        <p className="mt-0.5 text-[10px] text-vialto-steel/80">{caption}</p>
      )}
    </div>
  );
}


function EtapaModulo({
  wizard,
  paisFijo,
}: {
  wizard: ReturnType<typeof useImportWizard>;
  /** País fijo de la empresa — oculta el selector de país en "Ciudades a confirmar". */
  paisFijo: PaisCodigo | null;
}) {
  const p = wizard.preview;
  const [tiposVehiculo, setTiposVehiculo] = useState<Record<string, string>>(
    {},
  );

  // Campos que el tenant ocultó desde configuración (ej. NyM sin PAUT) no
  // deberían aparecer tampoco en el detalle de filas del import, aunque el
  // Excel los traiga — mismo criterio que ya usan los ViewModal de
  // Cliente/Transportista/Vehículo ("detalle_x"). Los 3 hooks se llaman
  // siempre (reglas de hooks) — cada uno cachea por módulo y no pesa si el
  // módulo actual no los necesita.
  const clientesFieldConfig = useFieldConfig("clientes");
  const transportistasFieldConfig = useFieldConfig("transportistas");
  const vehiculosFieldConfig = useFieldConfig("vehiculos");
  // El catálogo de import usa "condicionIva" (numérico); el de config de
  // campos lo unificó con condición tributaria bajo "condicionIvaTributaria".
  const ALIAS_CAMPO_VISIBILIDAD: Record<string, string> = {
    condicionIva: "condicionIvaTributaria",
  };
  function campoVisible(modulo: ModuloWizard | null, campo: string): boolean {
    const alias = ALIAS_CAMPO_VISIBILIDAD[campo] ?? campo;
    switch (modulo) {
      case "clientes":
        return clientesFieldConfig.isVisible("detalle_cliente", alias);
      case "transportistas":
        return transportistasFieldConfig.isVisible("detalle_transportista", alias);
      case "vehiculos":
        return vehiculosFieldConfig.isVisible("detalle_vehiculo", alias);
      default:
        // Choferes no tiene config de campos propia todavía — se muestra igual.
        return true;
    }
  }
  // Página de la tabla "Viajes en este archivo".
  const [tablaPage, setTablaPage] = useState(1);
  const VIAJES_PAGE_SIZE = 10;
  const [confirmarCamposFaltantes, setConfirmarCamposFaltantes] =
    useState(false);
  const [decisionesCampoUnico, setDecisionesCampoUnico] = useState<
    Record<number, "ignorar" | "actualizar">
  >({});
  const [ciudadesModalOpen, setCiudadesModalOpen] = useState(false);
  // Cada preview nuevo (nuevo módulo, o "reintentar" tras crear entidades
  // faltantes) trae su propia sesión — no arrastrar una confirmación vieja.
  useEffect(() => {
    setConfirmarCamposFaltantes(false);
    setDecisionesCampoUnico({});
    setTablaPage(1);
  }, [p?.sessionId]);

  // Un lookup de Viajes (cliente/transportista/chofer/vehículo) puede fallar
  // porque el valor no existe todavía — pero solo tiene sentido ofrecer
  // "crear y reintentar" si el usuario eligió importar ese módulo en esta
  // corrida. Si no lo eligió, la fila de Viajes simplemente no se importa
  // (el lookup fallido ya la deja fuera de `valid` en el backend) y acá solo
  // se avisa por qué, sin invitar a crear algo que no pidió tocar.
  const ENTIDAD_MODULO: Partial<Record<string, ModuloWizard>> = {
    clientes: "clientes",
    transportistas: "transportistas",
    choferes: "choferes",
    vehiculos: "vehiculos",
  };
  function moduloElegido(modelo: string): boolean {
    const modulo = ENTIDAD_MODULO[modelo];
    return !modulo || wizard.secuencia.includes(modulo);
  }
  function filasSinImportarPor(modelo: string): number[] {
    return [
      ...new Set(
        (p?.detalleErrores ?? [])
          .filter((e) => e.lookupModel === modelo)
          .map((e) => e.fila),
      ),
    ].sort((a, b) => a - b);
  }

  const entidadesFaltantesTodas = p?.entidadesFaltantes ?? [];
  const vehiculosFaltantes = moduloElegido("vehiculos")
    ? entidadesFaltantesTodas.find((e) => e.modelo === "vehiculos")
    : undefined;
  const otrasEntidadesFaltantes = entidadesFaltantesTodas.filter(
    (e) => e.modelo !== "vehiculos" && e.valores.length > 0 && moduloElegido(e.modelo),
  );
  const entidadesFaltantesSinModulo = entidadesFaltantesTodas.filter(
    (e) => e.valores.length > 0 && !moduloElegido(e.modelo),
  );
  const cuitErrors = (p?.detalleErrores ?? []).filter((e) =>
    e.error.includes("DNI/CUIT"),
  );
  // Los errores de lookup de un módulo no elegido ya se explican arriba
  // (panel ámbar de "no se importan"), no hace falta duplicarlos acá abajo
  // como si fueran un error bloqueante más. Los errores de CUIT se muestran
  // agrupados en el panel superior rojo.
  const detalleErroresMostrados = (p?.detalleErrores ?? []).filter(
    (e) =>
      (!e.lookupModel || moduloElegido(e.lookupModel)) &&
      !e.error.includes("DNI/CUIT"),
  );
  // `p.errores` cuenta errores individuales (una fila puede fallar por
  // varios campos a la vez, ej. cliente Y transportista Y chofer), no filas
  // — para el stat box usamos filas distintas, que es lo que dice la etiqueta.
  const filasConError = new Set(
    (p?.detalleErrores ?? []).map((e) => e.fila),
  ).size;

  const hasViajes = (p?.viajes?.length ?? 0) > 0;
  const hasFacturas = (p?.facturas?.length ?? 0) > 0;
  const advertenciasCiudad = p?.advertenciasCiudad ?? [];
  const advertenciasCamposFaltantes = p?.advertenciasCamposFaltantes ?? [];
  const camposFaltantesUnicos = Array.from(
    new Set(advertenciasCamposFaltantes.flatMap((a) => a.campos)),
  );
  const requiereConfirmarCamposFaltantes =
    advertenciasCamposFaltantes.length > 0 && !confirmarCamposFaltantes;
  const requiereResolverCiudades = advertenciasCiudad.length > 0;
  
  const erroresConsistenciaFacturas = p?.erroresConsistenciaFacturas ?? [];
  const requiereResolverConsistenciaFacturas = erroresConsistenciaFacturas.length > 0;

  const advertenciasCampoUnicoDuplicado =
    p?.advertenciasCampoUnicoDuplicado ?? [];
  // Ninguna fila trae algo nuevo o distinto a lo ya cargado: no hay nada que
  // guardar, así que el paso se reduce a un "Continuar" (sin avisos que pidan
  // confirmar nada).
  const todoSinCambios =
    !!p &&
    filasConError === 0 &&
    advertenciasCampoUnicoDuplicado.length === 0 &&
    (hasViajes
      ? advertenciasCiudad.length === 0 &&
        p.viajes!.every((v) => !v.nuevo && (!v.cambios || v.cambios.length === 0))
      : (p.filasDetalle?.length ?? 0) > 0 &&
        p.filasDetalle!.every((f) => !f.esNuevo && f.sinCambios));
  const requiereResolverCampoUnicoDuplicado = advertenciasCampoUnicoDuplicado.some(
    (c) => !decisionesCampoUnico[c.fila],
  );
  const advertenciasViajesFusionados =
    p?.advertenciasViajesFusionados ?? [];
  const motivosFusionados = Array.from(
    new Set(
      advertenciasViajesFusionados.map((a) =>
        a.motivo === "id"
          ? "comparten el mismo ID Personalizado"
          : "tienen idénticos datos operativos"
      )
    )
  ).join(" o ");
  // Tarjetas "Filas nuevas" / "Filas a actualizar": a actualizar cuenta solo
  // las filas que cambian algo (las "Sin cambios" no se escriben).
  const filasNuevasCount = hasViajes
    ? p!.viajes!.filter((v) => v.nuevo).length
    : p?.filasDetalle
      ? p.filasDetalle.filter((f) => f.esNuevo).length
      : (p?.entidadesNuevas ?? p?.exitosas ?? 0);
  const filasActualizarCount = hasViajes
    ? p!.viajes!.filter((v) => !v.nuevo && (v.cambios?.length ?? 0) > 0).length
    : p?.filasDetalle
      ? p.filasDetalle.filter((f) => !f.esNuevo && !f.sinCambios).length
      : (p?.entidadesActualizadas ?? 0);
  const cantStatBoxes = 3 + (hasFacturas ? 1 : 0);

  // Si el usuario resolvió (o excluyó) la última ciudad pendiente estando
  // dentro del modal, se cierra solo.
  useEffect(() => {
    if (advertenciasCiudad.length === 0) setCiudadesModalOpen(false);
  }, [advertenciasCiudad.length]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
        {labelModulo(wizard.moduloActual ?? "")}
      </h3>
      {wizard.loading && !p && <Spinner />}
      {p && (
        <fieldset
          disabled={wizard.loading}
          className="flex flex-col gap-4 border-0 p-0 m-0 disabled:opacity-60 transition-opacity"
        >
          <div
            className={`grid gap-2 ${
              // Cantidad real de StatBox renderizados (3 fijos + Facturas) —
              // si el grid asume más columnas que boxes, queda un hueco en
              // blanco a la derecha.
              cantStatBoxes === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"
              }`}
          >
            <StatBox label="Filas en el Excel" value={p.totalFilas} />
            {hasFacturas && (
              <StatBox label="Facturas" value={p.facturas?.length ?? 0} />
            )}
            <StatBox
              label="Filas nuevas"
              value={filasNuevasCount}
              highlight="ok"
              caption={
                (p.filasFusionadas ?? 0) > 0
                  ? `${p.filasFusionadas} fila${p.filasFusionadas! !== 1 ? "s" : ""} duplicada${p.filasFusionadas! !== 1 ? "s" : ""} unificada${p.filasFusionadas! !== 1 ? "s" : ""}`
                  : undefined
              }
            />
            <StatBox
              label="Filas a actualizar"
              value={filasActualizarCount}
              highlight="warn"
            />
          </div>

          {p.filasDetalle && p.filasDetalle.length > 0 && (
            <div>
              <p className="mb-1.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
                {labelModulo(wizard.moduloActual ?? "")} en este archivo
              </p>
              <FilasDetalleTabla
                filas={p.filasDetalle.map((f) => ({
                  ...f,
                  campos: f.campos.filter((c) =>
                    campoVisible(wizard.moduloActual, c.campo),
                  ),
                }))}
                conflictoDe={(fila) =>
                  advertenciasCampoUnicoDuplicado.find((c) => c.fila === fila)
                }
                decisionDe={(fila) => decisionesCampoUnico[fila]}
                onElegirDecision={(fila, accion) =>
                  setDecisionesCampoUnico((prev) => ({ ...prev, [fila]: accion }))
                }
              />
            </div>
          )}

          {/* Viajes: misma tabla que Clientes/Transportes, directo en el paso. */}
          {hasViajes && (() => {
            const meta = metaPaginacionCliente(
              p.viajes!.length,
              tablaPage,
              VIAJES_PAGE_SIZE,
            );
            return (
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
                    Viajes en este archivo
                  </p>
                  {filasActualizarCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        for (const v of p.viajes ?? []) {
                          if (!v.nuevo) wizard.ignorarFila(v.fila);
                        }
                      }}
                      className="border border-black/15 bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                    >
                      Ignorar todas las actualizaciones
                    </button>
                  )}
                </div>
                <ViajesCambiosList
                  viajes={slicePaginaCliente(p.viajes!, tablaPage, VIAJES_PAGE_SIZE)}
                  onIgnorarFila={wizard.ignorarFila}
                />
                {meta.totalPages > 1 && (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="text-vialto-steel">
                      Página {meta.page} de {meta.totalPages} · {meta.total} filas
                    </span>
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!meta.hasPrev}
                        onClick={() => setTablaPage((n) => Math.max(1, n - 1))}
                        className="h-8 min-w-8 border border-black/20 px-2 text-xs uppercase tracking-wider hover:bg-vialto-mist/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      {paginasVisibles(meta.page, meta.totalPages).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setTablaPage(n)}
                          aria-current={n === meta.page ? "page" : undefined}
                          className={[
                            "h-8 min-w-8 px-2 border text-xs tabular-nums",
                            n === meta.page
                              ? "border-vialto-charcoal bg-vialto-charcoal text-white"
                              : "border-black/20 text-vialto-charcoal hover:bg-vialto-mist/80",
                          ].join(" ")}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={!meta.hasNext}
                        onClick={() =>
                          setTablaPage((n) => Math.min(meta.totalPages, n + 1))
                        }
                        className="h-8 min-w-8 border border-black/20 px-2 text-xs uppercase tracking-wider hover:bg-vialto-mist/80 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {p.headersNoMapeados.length > 0 && (
            <ImportAlert
              color="blue"
              title={`${p.headersNoMapeados.length} columna${p.headersNoMapeados.length !== 1 ? "s" : ""} del Excel sin usar`}
              subtitle="— no bloquean la importación"
            >
              <p>{p.headersNoMapeados.join(", ")}</p>
            </ImportAlert>
          )}

          {cuitErrors.length > 0 && (
            <ImportAlert
              color="red"
              title={`${cuitErrors.length} transportista${cuitErrors.length !== 1 ? "s" : ""} bloqueado${cuitErrors.length !== 1 ? "s" : ""}`}
              subtitle="— no se pueden crear solo con DNI/CUIT"
            >
              <p>
                El Excel tiene DNI/CUIT en la columna de Transportista, pero este
                no existe en la base de datos. Para que el sistema pueda crearlo
                automáticamente, necesitás poner su Nombre completo. Opcionalmente,
                podés importar los transportistas primero. Afecta a las filas:{" "}
                <span className="font-medium">
                  {cuitErrors.map((e) => e.fila).join(", ")}
                </span>
                .
              </p>
            </ImportAlert>
          )}

          {advertenciasCiudad.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <span>
                <strong>{advertenciasCiudad.length}</strong> ciudad
                {advertenciasCiudad.length !== 1 ? "es" : ""} sin confirmar —
                hay que resolverlas para poder continuar.
              </span>
              <button
                type="button"
                onClick={() => setCiudadesModalOpen(true)}
                className="shrink-0 border border-amber-300 bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-wider text-amber-900 hover:bg-amber-100"
              >
                Revisar ciudades
              </button>
            </div>
          )}

          {vehiculosFaltantes && vehiculosFaltantes.valores.length > 0 && (
            <div className="flex flex-col gap-2 border border-vialto-charcoal/20 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-vialto-steel">
                Faltan {vehiculosFaltantes.valores.length} vehículo
                {vehiculosFaltantes.valores.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-vialto-steel">
                No existen en el sistema todavía. Elegí el tipo de cada uno y
                creálos - después se vuelve a previsualizar solo.
              </p>
              <div className="overflow-x-auto border border-black/10">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className={th}>Patente</th>
                      <th className={th}>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehiculosFaltantes.valores.map((v) => (
                      <tr key={v.valor}>
                        <td className={`${td} font-mono`}>{v.valor}</td>
                        <td className={td}>
                          <select
                            value={tiposVehiculo[v.valor] ?? v.tipoSugerido ?? ""}
                            onChange={(e) =>
                              setTiposVehiculo((prev) => ({
                                ...prev,
                                [v.valor]: e.target.value,
                              }))
                            }
                            className="h-8 w-full min-w-[9rem] border border-black/20 px-2 text-xs"
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
              <button
                type="button"
                onClick={() => {
                  const items = vehiculosFaltantes.valores.map((v) => ({
                    patente: v.valor,
                    tipo: tiposVehiculo[v.valor] ?? v.tipoSugerido ?? "",
                  }));
                  if (items.some((i) => !i.tipo)) return;
                  void wizard.crearVehiculosFaltantes(items);
                }}
                disabled={
                  wizard.loading ||
                  vehiculosFaltantes.valores.some(
                    (v) => !(tiposVehiculo[v.valor] ?? v.tipoSugerido),
                  )
                }
                className="self-start border border-black/15 bg-vialto-charcoal px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-black disabled:opacity-50"
              >
                {wizard.loading
                  ? "Creando…"
                  : `Crear ${vehiculosFaltantes.valores.length} vehículo${vehiculosFaltantes.valores.length !== 1 ? "s" : ""} y reintentar`}
              </button>
            </div>
          )}

          {otrasEntidadesFaltantes.map((grupo) => (
            <div
              key={grupo.modelo}
              className="flex flex-col gap-2 border border-vialto-charcoal/20 px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wider text-vialto-steel">
                Faltan {grupo.valores.length} {labelModulo(grupo.modelo)}
              </p>
              <p className="text-xs text-vialto-steel">
                No existen en el sistema todavía:{" "}
                <strong>{grupo.valores.map((v) => v.valor).join(", ")}</strong>.
                Se crean solo con el nombre — después se vuelve a
                previsualizar solo.
              </p>
              <button
                type="button"
                disabled={wizard.loading}
                onClick={() =>
                  void wizard.crearEntidadesFaltantesSimple(
                    grupo.modelo,
                    grupo.valores.map((v) => v.valor),
                  )
                }
                className="self-start border border-black/15 bg-vialto-charcoal px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-white hover:bg-black disabled:opacity-50"
              >
                {wizard.loading
                  ? "Creando…"
                  : `Crear ${grupo.valores.length} ${labelModulo(grupo.modelo).toLowerCase()} y reintentar`}
              </button>
            </div>
          ))}

          {entidadesFaltantesSinModulo.map((grupo) => {
            const filas = filasSinImportarPor(grupo.modelo);
            return (
              <ImportAlert
                key={grupo.modelo}
                color="amber"
                collapsible={false}
                title={
                  <>
                    <strong>
                      {filas.length > 0 ? filas.length : grupo.valores.length}
                    </strong>{" "}
                    fila{(filas.length || grupo.valores.length) !== 1 ? "s" : ""}{" "}
                    de Viajes no se {(filas.length || grupo.valores.length) !== 1 ? "van" : "va"} a
                    importar porque hacen referencia a{" "}
                    {labelModulo(grupo.modelo).toLowerCase()} que no existen (
                    <strong>
                      {grupo.valores.map((v) => v.valor).join(", ")}
                    </strong>
                    ) y no elegiste importar ese módulo en esta corrida.
                  </>
                }
              >
                {filas.length > 0 && (
                  <p className="text-amber-800">
                    Fila{filas.length !== 1 ? "s" : ""}: {filas.join(", ")}.
                  </p>
                )}
                <p className="text-amber-800 mt-1">
                  Para incluirlas, volvé a empezar y tildá{" "}
                  {labelModulo(grupo.modelo)} en el selector, o cargá esos
                  registros a mano antes de importar Viajes.
                </p>
              </ImportAlert>
            );
          })}

          {advertenciasCamposFaltantes.length > 0 && !todoSinCambios && (
            <ImportAlert
              color="amber"
              collapsible={false}
              title={
                <>
                  <strong>{advertenciasCamposFaltantes.length}</strong> fila
                  {advertenciasCamposFaltantes.length !== 1 ? "s" : ""} sin{" "}
                  <strong>{camposFaltantesUnicos.join(", ")}</strong>
                </>
              }
              subtitle="— se puede completar después a mano."
              action={
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-amber-900">
                  <input
                    type="checkbox"
                    checked={confirmarCamposFaltantes}
                    onChange={(e) =>
                      setConfirmarCamposFaltantes(e.target.checked)
                    }
                    className="h-5 w-5 accent-vialto-charcoal"
                  />
                  Entiendo, importar estas filas igual
                </label>
              }
            />
          )}

          {advertenciasViajesFusionados.length > 0 && (
            <ImportAlert
              color="amber"
              collapsible={true}
              title={
                <>
                  Hay{" "}
                  <strong>{advertenciasViajesFusionados.length}</strong> grupo
                  {advertenciasViajesFusionados.length !== 1 ? "s" : ""} de
                  viajes duplicados en tu archivo porque{" "}
                  <strong>
                    {motivosFusionados}
                  </strong>.
                </>
              }
              subtitle="El sistema los unificará creando un único viaje por grupo usando los datos de la primera fila. Filas afectadas:"
            >
              <ul className="mt-2 ml-4 list-disc space-y-1">
                {advertenciasViajesFusionados.map((d, i) => (
                  <li key={i}>{d.identificador}</li>
                ))}
              </ul>
            </ImportAlert>
          )}

          {erroresConsistenciaFacturas.length > 0 && (
            <ImportAlert
              color="red"
              collapsible={false}
              title={
                <>
                  <strong>{erroresConsistenciaFacturas.length}</strong>{" "}
                  número{erroresConsistenciaFacturas.length !== 1 ? "s" : ""}{" "}
                  de factura inconsistente{erroresConsistenciaFacturas.length !== 1 ? "s" : ""}:{" "}
                  <strong>
                    {erroresConsistenciaFacturas.map((e) => e.numero).join(", ")}
                  </strong>
                </>
              }
              subtitle=" — Estos números de factura están asignados a clientes diferentes en la base de datos o en el archivo. Revisá el excel y asegurate de usar un número único por cliente."
            />
          )}

          {detalleErroresMostrados.length > 0 && (
            <ImportAlert
              color="red"
              title={`${detalleErroresMostrados.length} error${detalleErroresMostrados.length !== 1 ? "es" : ""} de validación`}
              subtitle="— bloquean la importación"
            >
              <div className="max-h-40 overflow-y-auto border border-red-100">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-red-50">
                    <tr>
                      <th className={`${th} text-red-900`}>Fila</th>
                      <th className={`${th} text-red-900`}>Campo</th>
                      <th className={`${th} text-red-900`}>Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {detalleErroresMostrados.map((e, i) => (
                      <tr key={i} className="odd:bg-white even:bg-red-50/40">
                        <td className={td}>{e.fila}</td>
                        <td className={td}>{e.campo ?? "—"}</td>
                        <td className={td}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ImportAlert>
          )}
        </fieldset>
      )}
      {p && todoSinCambios && (
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            disabled={wizard.loading}
            onClick={wizard.continuarSinCambios}
            className="inline-flex items-center gap-2 border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
          >
            Continuar →
          </button>
        </div>
      )}
      {p && !todoSinCambios && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={wizard.loading}
            onClick={wizard.saltearModuloActual}
            className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            No importar esta hoja
          </button>
          <button
            type="button"
            disabled={
              wizard.loading ||
              p.exitosas === 0 ||
              requiereConfirmarCamposFaltantes ||
              requiereResolverCiudades ||
              requiereResolverConsistenciaFacturas ||
              requiereResolverCampoUnicoDuplicado
            }
            onClick={() =>
              void wizard.confirmarModuloActual(
                confirmarCamposFaltantes,
                Object.entries(decisionesCampoUnico).map(([fila, accion]) => ({
                  fila: Number(fila),
                  accion,
                })),
              )
            }
            title={
              requiereResolverCiudades
                ? "Resolvé las ciudades pendientes para continuar"
                : requiereResolverConsistenciaFacturas
                  ? "Resolvé las inconsistencias de facturación en el archivo"
                  : requiereResolverCampoUnicoDuplicado
                    ? "Elegí ignorar o actualizar para cada fila duplicada"
                    : requiereConfirmarCamposFaltantes
                      ? "Marcá la casilla de arriba para confirmar"
                      : undefined
            }
            className="inline-flex items-center gap-2 border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
          >
            {wizard.loading && <Spinner className="h-3.5 w-3.5" />}
            {wizard.loading ? "Guardando…" : "Guardar y continuar"}
          </button>
        </div>
      )}

      {p && ciudadesModalOpen && (
        <div
          className={modalEditOverlayClass}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCiudadesModalOpen(false);
          }}
        >
          <div className={modalEditPanelClass}>
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
              <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
                Ciudades a confirmar
              </h2>
              <button
                type="button"
                onClick={() => setCiudadesModalOpen(false)}
                className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none px-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <CiudadAdvertenciasPanel
                advertencias={advertenciasCiudad}
                onElegir={wizard.elegirCiudad}
                onIgnorarFila={wizard.ignorarFila}
                paisFijo={paisFijo}
              />
            </div>
            <div className="flex justify-end border-t border-black/10 px-6 py-4">
              <button
                type="button"
                onClick={() => setCiudadesModalOpen(false)}
                className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/** Campos que se muestran para una fila nueva, o que se comparan antes/después para una que actualiza. */
const CAMPOS_VIAJE_MOSTRAR: { key: keyof ImportPreviewViaje; label: string }[] = [
  { key: "cliente", label: "Cliente" },
  { key: "transporte", label: "Transporte" },
  { key: "chofer", label: "Chofer" },
  { key: "vehiculo", label: "Vehículo" },
  { key: "origen", label: "Origen" },
  { key: "destino", label: "Destino" },
  { key: "fechaCarga", label: "F. Carga" },
  { key: "fechaDescarga", label: "F. Descarga" },
  { key: "detalleCarga", label: "Carga" },
  { key: "monto", label: "Monto" },
  { key: "monedaMonto", label: "Moneda" },
  { key: "nroFactura", label: "Nro FC" },
  { key: "precioTransportistaExterno", label: "Flete" },
  { key: "monedaPrecioTransportistaExterno", label: "Moneda Flete" },
];

function ViajesCambiosList({
  viajes,
  onIgnorarFila,
}: {
  viajes: ImportPreviewViaje[];
  onIgnorarFila: (fila: number) => void;
}) {
  const fmt = (v: unknown) => (v != null && v !== "" ? String(v) : "—");

  if (viajes.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-vialto-steel">
        No hay viajes en esta página.
      </p>
    );
  }

  // Solo las columnas que tienen dato en alguna fila de la página.
  const columnas = CAMPOS_VIAJE_MOSTRAR.filter((c) =>
    viajes.some((v) => v[c.key] != null && v[c.key] !== ""),
  );
  const th =
    "px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.1em] text-vialto-steel whitespace-nowrap";
  const td = "px-3 py-2 text-sm text-vialto-charcoal whitespace-nowrap";
  const colSpan = columnas.length + 2;
  const listaCambios = (cambios: { campo: string; antes: unknown; despues: unknown }[]) => (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
      {cambios.map((c, i) => (
        <span key={i} className="text-xs">
          <span className="font-medium text-vialto-charcoal">{c.campo}:</span>{" "}
          <span className="text-vialto-steel line-through decoration-red-400">
            {fmt(c.antes)}
          </span>
          <span className="mx-1 text-vialto-steel">→</span>
          <span className="font-medium text-vialto-charcoal">{fmt(c.despues)}</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-x-auto border border-black/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black/10 bg-vialto-mist/50">
            <th className={`${th} w-14`}>Fila</th>
            {columnas.map((c) => (
              <th key={c.key} className={th}>
                {c.label}
              </th>
            ))}
            <th className={`${th} text-right`}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {viajes.map((v) => {
            const unificado = !!v.filasAgrupadas && v.filasAgrupadas.length > 1;
            const sinCambios = !v.nuevo && (!v.cambios || v.cambios.length === 0);
            return (
              <Fragment key={v.fila}>
                <tr className="border-t border-black/5 first:border-t-0">
                  <td className={`${td} text-vialto-steel tabular-nums`}>
                    {unificado ? v.filasAgrupadas!.join(", ") : v.fila}
                  </td>
                  {columnas.map((c) => (
                    <td key={c.key} className={td}>
                      {v[c.key] != null && v[c.key] !== "" ? (
                        String(v[c.key])
                      ) : (
                        <span className="text-vialto-steel/50">—</span>
                      )}
                    </td>
                  ))}
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-1.5">
                      {unificado && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 uppercase tracking-wider">
                          Unificado
                        </span>
                      )}
                      {v.nuevo ? (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 uppercase tracking-wider">
                          Nuevo
                        </span>
                      ) : sinCambios ? (
                        <span className="text-[10px] px-1.5 py-0.5 border border-black/10 text-vialto-steel/70 uppercase tracking-wider">
                          Sin cambios
                        </span>
                      ) : (
                        <>
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 uppercase tracking-wider">
                            Actualiza
                          </span>
                          <button
                            type="button"
                            onClick={() => onIgnorarFila(v.fila)}
                            className="border border-black/15 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
                          >
                            Ignorar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Fila que actualiza un viaje existente: qué cambia. */}
                {!v.nuevo && !sinCambios && (
                  <tr>
                    <td colSpan={colSpan} className="px-3 pb-2">
                      {listaCambios(v.cambios!)}
                    </td>
                  </tr>
                )}

                {v.advertenciaSobrescritura && (
                  <tr className="bg-amber-50/60">
                    <td colSpan={colSpan} className="px-3 py-2 text-xs text-amber-900">
                      <p className="mb-1">
                        <strong>Datos distintos entre las filas unificadas</strong> — se
                        conservan los de la fila {v.fila}; se pierden:
                      </p>
                      {v.cambiosSobrescritura && v.cambiosSobrescritura.length > 0 &&
                        listaCambios(v.cambiosSobrescritura)}
                    </td>
                  </tr>
                )}

                {v.advertenciasCiudad && v.advertenciasCiudad.length > 0 && (
                  <tr>
                    <td colSpan={colSpan} className="px-3 pb-2 text-[11px] text-amber-700">
                      ⚠ Tiene ciudad sin confirmar — revisala en "Revisar ciudades".
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** El backend manda `condicionIva` como el código crudo (1/4/5/6) — acá se traduce al mismo texto que ya usan las vistas de Cliente/Transportista, en vez de mostrar el número pelado. */
function valorFilaDetalle(campo: string, valor: string): string {
  if (campo === "condicionIva") {
    const n = Number(valor);
    if (Number.isFinite(n)) return condicionIvaLabel(n);
  }
  return valor;
}

/**
 * Filas del archivo para los módulos "simples" (Clientes, Transportes,
 * Choferes, Vehículos): tabla compacta, una columna por campo + Estado. Las
 * filas con ID Fiscal/DNI duplicado llevan debajo una franja con la decisión
 * (Ignorar / Actualizar) — ver "Conflicto de campo único" en CLAUDE.md.
 */
function FilasDetalleTabla({
  filas,
  conflictoDe,
  decisionDe,
  onElegirDecision,
}: {
  filas: ImportPreviewFilaEntidad[];
  conflictoDe: (fila: number) => ImportCampoUnicoConflicto | undefined;
  decisionDe: (fila: number) => "ignorar" | "actualizar" | undefined;
  onElegirDecision: (fila: number, accion: "ignorar" | "actualizar") => void;
}) {
  // Columnas = unión de campos en el orden en que aparecen (una fila puede
  // no traer todos los campos si la celda venía vacía).
  const columnas: { campo: string; label: string }[] = [];
  for (const f of filas) {
    for (const c of f.campos) {
      if (!columnas.some((col) => col.campo === c.campo)) {
        columnas.push({ campo: c.campo, label: c.label });
      }
    }
  }
  const th =
    "px-3 py-2 text-left font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[0.1em] text-vialto-steel whitespace-nowrap";
  const td = "px-3 py-2 text-sm text-vialto-charcoal";
  const botonDecision = (activo: boolean) =>
    `px-2.5 py-1 border text-[11px] font-semibold uppercase tracking-wide ${
      activo
        ? "border-vialto-charcoal bg-vialto-charcoal text-white"
        : "border-amber-300 text-amber-900 hover:bg-amber-100"
    }`;

  return (
    <div className="overflow-x-auto border border-black/10">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black/10 bg-vialto-mist/50">
            <th className={`${th} w-14`}>Fila</th>
            {columnas.map((col) => (
              <th key={col.campo} className={th}>
                {col.label}
              </th>
            ))}
            <th className={`${th} text-right`}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const conflicto = conflictoDe(f.fila);
            const decision = decisionDe(f.fila);
            const valores = new Map(f.campos.map((c) => [c.campo, c.valor]));
            return (
              <Fragment key={f.fila}>
                <tr
                  className={`border-t border-black/5 first:border-t-0 ${
                    conflicto ? "bg-amber-50/60" : ""
                  }`}
                >
                  <td className={`${td} text-vialto-steel tabular-nums`}>{f.fila}</td>
                  {columnas.map((col) => {
                    const valor = valores.get(col.campo);
                    return (
                      <td key={col.campo} className={td}>
                        {valor ? (
                          valorFilaDetalle(col.campo, valor)
                        ) : (
                          <span className="text-vialto-steel/50">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {conflicto ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-900 uppercase tracking-wider">
                        {conflicto.campoLabel} duplicado
                      </span>
                    ) : f.esNuevo ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 uppercase tracking-wider">
                        Nuevo
                      </span>
                    ) : f.sinCambios ? (
                      <span className="text-[10px] px-1.5 py-0.5 border border-black/10 text-vialto-steel/70 uppercase tracking-wider">
                        Sin cambios
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-vialto-mist text-vialto-steel uppercase tracking-wider">
                        Actualiza
                      </span>
                    )}
                  </td>
                </tr>
                {conflicto && (
                  <tr className="bg-amber-50/60">
                    <td colSpan={columnas.length + 2} className="px-3 pb-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                        <span>
                          {conflicto.campoLabel} <strong>{conflicto.valor}</strong> ya es
                          de <strong>{conflicto.entidadExistenteNombre}</strong> — elegí
                          qué hacer:
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => onElegirDecision(f.fila, "ignorar")}
                            className={botonDecision(decision === "ignorar")}
                          >
                            Ignorar fila
                          </button>
                          <button
                            type="button"
                            onClick={() => onElegirDecision(f.fila, "actualizar")}
                            className={botonDecision(decision === "actualizar")}
                          >
                            Actualizar {conflicto.entidadExistenteNombre}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EtapaOpcional<T>({
  titulo,
  descripcion,
  loading,
  preview,
  onPedirPreview,
  onSaltear,
  onConfirmar,
  onReiniciar,
  renderTabla,
  confirmDisabled,
}: {
  titulo: string;
  descripcion: string;
  loading: boolean;
  preview: T[] | null;
  onPedirPreview: () => void;
  onSaltear: () => void;
  onConfirmar: () => void;
  onReiniciar?: () => void;
  renderTabla: (items: T[] | null) => React.ReactNode;
  confirmDisabled?: boolean;
}) {
  // Se pide el preview apenas se entra a esta etapa — antes había un botón
  // "Ver preview" intermedio que no aportaba nada (el usuario ya eligió el
  // módulo en el selector previo), solo un click extra antes de ver la tabla.
  useEffect(() => {
    onPedirPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasItems = preview && preview.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
        {titulo}
      </h3>
      {hasItems && <p className="text-sm text-vialto-steel">{descripcion}</p>}

      {!preview && loading && (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      )}

      {/* Si `onPedirPreview` falló, `loading` ya bajó pero `preview` sigue en null: sin esto el usuario quedaría sin forma de reintentar o saltear la etapa. */}
      {!preview && !loading && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPedirPreview}
            className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={onSaltear}
            className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04]"
          >
            No, gracias
          </button>
        </div>
      )}

      {preview && (
        <>
          {renderTabla(preview)}
          <div className="flex gap-3">
            {hasItems ? (
              <>
                <button
                  type="button"
                  disabled={loading || confirmDisabled}
                  onClick={onConfirmar}
                  className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
                >
                  {loading ? "Guardando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={onSaltear}
                  className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04]"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={onSaltear}
                  className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
                >
                  Siguiente →
                </button>
                {onReiniciar && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={onReiniciar}
                    className="border border-black/15 border-black/15 bg-white px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    Volver a importar
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Tenant sin el módulo correspondiente: se saltea la etapa sin mostrar nada. */
function AvanceSilencioso({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    onNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
