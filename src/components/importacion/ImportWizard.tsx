import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Upload } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { ListadoCard } from "@/components/listado/ListadoCard";
import {
  ListadoDatos,
  type ListadoColumn,
} from "@/components/listado/ListadoDatos";
import { listadoTablaTdClass } from "@/lib/listadoTabla";
import { labelModulo } from "@/lib/platformLabels";
import {
  MODULOS_SECUENCIA,
  useImportWizard,
} from "@/hooks/useImportWizard";
import { CiudadAdvertenciasPanel } from "@/components/importacion/CiudadAdvertenciasPanel";
import type {
  ImportPreviewViaje,
  ImportPreviewFactura,
  ImportPreviewEntidad,
} from "@/types/api";

interface ImportWizardProps {
  tenantId: string;
  tenantModules: string[];
  /** Adónde vuelve el botón "Listo" al terminar el wizard. */
  backTo: string;
  /**
   * Base de la URL de configuración de templates (ej.
   * `/superadmin/empresas/:orgId/importar/templates`). Solo el superadmin la
   * tiene — cuando está presente, un error de columnas faltantes ofrece un
   * link directo a corregir el template de ese módulo. El tenant-admin no
   * tiene acceso a esa pantalla, así que en su lugar ve un mensaje para que
   * le pida el ajuste a su administrador.
   */
  templatesTo?: string;
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
 * Wizard paso a paso del import: Clientes → Transportes → Choferes →
 * Vehículos → Viajes → (opcional) Liquidaciones borrador → (opcional)
 * Facturar a clientes. Cada etapa se previsualiza y confirma por separado —
 * no hay un botón único que confirme todo el archivo de una vez.
 * Compartido entre tenant-admin y superadmin: la única diferencia entre
 * ambos es qué `tenantId`/`tenantModules` se le pasa desde la página que lo
 * hostea.
 */
export function ImportWizard({
  tenantId,
  tenantModules,
  backTo,
  templatesTo,
}: ImportWizardProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const wizard = useImportWizard(tenantId, [...MODULOS_SECUENCIA], () =>
    getToken(),
  );

  const hasArca = tenantModules.includes("integracion-arca");
  const hasFacturacion = tenantModules.includes("facturacion");

  const [numerosPorCliente, setNumerosPorCliente] = useState<
    Record<string, string>
  >({});

  const columnasFaltantes = wizard.error?.startsWith(
    PREFIJO_COLUMNAS_FALTANTES,
  )
    ? wizard.error.slice(PREFIJO_COLUMNAS_FALTANTES.length).trim()
    : null;
  const moduloLabel = labelModulo(wizard.moduloActual ?? "");

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper
        wizard={wizard}
        hasArca={hasArca}
        hasFacturacion={hasFacturacion}
      />

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
        </div>
      )}

      {wizard.error && !columnasFaltantes && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {wizard.error}
        </div>
      )}

      <div className="border border-black/10 bg-white p-6">
        {wizard.fase === "upload" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-vialto-steel">
              Subí un único Excel con las hojas de Clientes, Transportes,
              Choferes, Vehículos y Viajes. Se van a procesar en ese orden,
              una hoja a la vez.
            </p>
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
              ].join(" ")}
            >
              <Upload className="h-6 w-6" strokeWidth={1.5} />
              <span className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-wider text-vialto-charcoal">
                Arrastrá el archivo o hacé clic para seleccionarlo
              </span>
              <span className="text-xs">.xlsx o .xls</span>
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
          </div>
        )}

        {wizard.fase === "modulo" && wizard.moduloActual && (
          <EtapaModulo wizard={wizard} />
        )}

      {wizard.fase === "post-liquidaciones" && hasArca && (
        <EtapaOpcional
          titulo="Generar liquidaciones borrador"
          descripcion="Se van a agrupar los viajes recién creados por transportista. Ninguna liquidación se emite a AFIP — quedan en borrador para que las emitas manualmente cuando quieras."
          loading={wizard.loading}
          preview={wizard.liquidacionesPreview}
          onPedirPreview={wizard.pedirPreviewLiquidaciones}
          onSaltear={wizard.saltearLiquidaciones}
          onConfirmar={wizard.confirmarLiquidaciones}
          renderTabla={(items: typeof wizard.liquidacionesPreview) =>
            items && items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>Transportista</th>
                    <th className={th}>Viajes</th>
                    <th className={th}>Período</th>
                    <th className={th}>Bruto</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.transportistaId}>
                      <td className={td}>{g.transportistaNombre}</td>
                      <td className={td}>{g.cantidadViajes}</td>
                      <td className={td}>
                        {g.periodoDesde} — {g.periodoHasta}
                      </td>
                      <td className={td}>
                        {g.bruto.toLocaleString("es-AR", {
                          style: "currency",
                          currency: "ARS",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-vialto-steel">
                No hay viajes con transportista externo para liquidar.
              </p>
            )
          }
        />
      )}
      {wizard.fase === "post-liquidaciones" && !hasArca && (
        <AvanceSilencioso onNext={wizard.saltearLiquidaciones} />
      )}

      {wizard.fase === "post-facturas" && (hasArca || hasFacturacion) && (
        <EtapaOpcional
          titulo="Facturar a clientes"
          descripcion="Se van a agrupar los viajes recién creados por cliente."
          loading={wizard.loading}
          preview={wizard.facturasPreview}
          onPedirPreview={wizard.pedirPreviewFacturas}
          onSaltear={wizard.saltearFacturas}
          onConfirmar={() =>
            wizard.confirmarFacturas(
              hasArca ? undefined : numerosPorCliente,
            )
          }
          confirmDisabled={
            !hasArca &&
            (wizard.facturasPreview?.some(
              (g) => !numerosPorCliente[g.clienteId]?.trim(),
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
                    <th className={th}>Importe</th>
                    {!hasArca && <th className={th}>N° de factura</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((g) => (
                    <tr key={g.clienteId}>
                      <td className={td}>{g.clienteNombre}</td>
                      <td className={td}>{g.cantidadViajes}</td>
                      <td className={td}>
                        {g.importe.toLocaleString("es-AR", {
                          style: "currency",
                          currency: g.moneda,
                        })}
                      </td>
                      {!hasArca && (
                        <td className={td}>
                          <input
                            type="text"
                            value={numerosPorCliente[g.clienteId] ?? ""}
                            onChange={(e) =>
                              setNumerosPorCliente((prev) => ({
                                ...prev,
                                [g.clienteId]: e.target.value,
                              }))
                            }
                            placeholder="0001-00000001"
                            className="h-8 w-full border border-black/20 px-2 text-sm"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-vialto-steel">
                No hay viajes para facturar.
              </p>
            )
          }
        />
      )}
      {wizard.fase === "post-facturas" && !hasArca && !hasFacturacion && (
        <AvanceSilencioso onNext={wizard.saltearFacturas} />
      )}

      {wizard.fase === "terminado" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-vialto-charcoal">Import terminado.</p>
          <ul className="flex flex-col gap-1 text-sm text-vialto-steel">
            {wizard.etapasCompletadas.map((e) => (
              <li key={e.modulo}>
                {labelModulo(e.modulo)}: {e.log.exitosas} creados/actualizados
                {e.log.errores > 0 ? `, ${e.log.errores} con error` : ""}
              </li>
            ))}
            {wizard.liquidacionesCreadas && (
              <li>
                Liquidaciones borrador: {wizard.liquidacionesCreadas.length}
              </li>
            )}
            {wizard.facturasCreadas && (
              <li>Facturas: {wizard.facturasCreadas.length}</li>
            )}
          </ul>
          <Link
            to={backTo}
            className="self-start border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black"
          >
            Listo
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}

function WizardStepper({
  wizard,
  hasArca,
  hasFacturacion,
}: {
  wizard: ReturnType<typeof useImportWizard>;
  hasArca: boolean;
  hasFacturacion: boolean;
}) {
  const pasos = [
    ...wizard.secuencia.map((m) => ({ key: m as string, label: labelModulo(m) })),
    ...(hasArca ? [{ key: "post-liquidaciones", label: "Liquidaciones" }] : []),
    ...(hasArca || hasFacturacion
      ? [{ key: "post-facturas", label: "Facturas" }]
      : []),
  ];

  const indiceActual =
    wizard.fase === "upload"
      ? -1
      : wizard.fase === "modulo"
        ? wizard.moduloIndex
        : wizard.fase === "post-liquidaciones"
          ? wizard.secuencia.length
          : wizard.fase === "post-facturas"
            ? wizard.secuencia.length + (hasArca ? 1 : 0)
            : pasos.length;

  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {pasos.map((p, i) => {
        const estado =
          i < indiceActual ? "done" : i === indiceActual ? "current" : "pending";
        return (
          <li key={p.key} className="flex items-center gap-1.5">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-ui)] text-[11px] font-semibold",
                estado === "done" ? "bg-vialto-charcoal text-white" : "",
                estado === "current"
                  ? "bg-vialto-fire text-white"
                  : "",
                estado === "pending"
                  ? "border border-black/15 text-vialto-steel"
                  : "",
              ].join(" ")}
            >
              {estado === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </span>
            <span
              className={[
                "font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider",
                estado === "current" ? "text-vialto-charcoal font-semibold" : "text-vialto-steel",
              ].join(" ")}
            >
              {p.label}
            </span>
            {i < pasos.length - 1 && (
              <span className="mx-1 text-black/15">—</span>
            )}
          </li>
        );
      })}
    </ol>
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

function EtapaModulo({
  wizard,
}: {
  wizard: ReturnType<typeof useImportWizard>;
}) {
  const p = wizard.preview;
  const [tiposVehiculo, setTiposVehiculo] = useState<Record<string, string>>(
    {},
  );
  const [tab, setTab] = useState<PreviewTab>("viajes");

  const vehiculosFaltantes = p?.entidadesFaltantes.find(
    (e) => e.modelo === "vehiculos",
  );
  const otrasEntidadesFaltantes =
    p?.entidadesFaltantes.filter(
      (e) => e.modelo !== "vehiculos" && e.valores.length > 0,
    ) ?? [];

  const hasViajes = (p?.viajes?.length ?? 0) > 0;
  const hasFacturas = (p?.facturas?.length ?? 0) > 0;
  const hasClientes = (p?.clientes?.length ?? 0) > 0;
  const hasTransportistas = (p?.transportistas?.length ?? 0) > 0;
  const advertenciasCiudad = p?.advertenciasCiudad ?? [];
  const totalAdvertenciasCiudad =
    p?.totalAdvertenciasCiudad ?? advertenciasCiudad.length;
  const nuevosClientes = p?.clientes?.filter((c) => c.esNuevo).length ?? 0;
  const nuevosTransp =
    p?.transportistas?.filter((t) => t.esNuevo).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
        {labelModulo(wizard.moduloActual ?? "")}
      </h3>
      {wizard.loading && !p && <Spinner />}
      {p && (
        <>
          <div
            className={`grid gap-2 ${hasViajes ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"}`}
          >
            <StatBox label="Filas totales" value={p.totalFilas} />
            <StatBox label="Listas para crear" value={p.exitosas} highlight="ok" />
            <StatBox
              label="Errores"
              value={p.errores}
              highlight={p.errores > 0 ? "error" : undefined}
            />
            {hasFacturas && (
              <StatBox label="Facturas" value={p.facturas?.length ?? 0} />
            )}
            {hasViajes && (
              <StatBox
                label="Adv. ciudades"
                value={totalAdvertenciasCiudad}
                highlight={totalAdvertenciasCiudad > 0 ? "warn" : undefined}
              />
            )}
          </div>

          {p.headersNoMapeados.length > 0 && (
            <div className="border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
              El Excel tiene columnas que el template no reconoce — van a
              quedar como texto libre en Observaciones, sin bloquear la
              importación: <strong>{p.headersNoMapeados.join(", ")}</strong>.
            </div>
          )}

          {p.columnasOpcionalesFaltantes.length > 0 && (
            <div className="border border-amber-100 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              El template espera estas columnas y no aparecen en el Excel —
              quedan vacías en todas las filas:{" "}
              <strong>{p.columnasOpcionalesFaltantes.join(", ")}</strong>.
            </div>
          )}

          <CiudadAdvertenciasPanel
            advertencias={advertenciasCiudad}
            onElegir={wizard.elegirCiudad}
            onIgnorarFila={wizard.ignorarFila}
          />

          {vehiculosFaltantes && vehiculosFaltantes.valores.length > 0 && (
            <div className="flex flex-col gap-2 border border-vialto-charcoal/20 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-vialto-steel">
                Faltan {vehiculosFaltantes.valores.length} vehículo
                {vehiculosFaltantes.valores.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-vialto-steel">
                No existen en el sistema todavía. Elegí el tipo de cada uno y
                creálos — después se vuelve a previsualizar solo.
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

          {p.detalleErrores.length > 0 && (
            <div className="max-h-40 overflow-y-auto border border-black/10">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className={th}>Fila</th>
                    <th className={th}>Campo</th>
                    <th className={th}>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {p.detalleErrores.map((e, i) => (
                    <tr key={i}>
                      <td className={td}>{e.fila}</td>
                      <td className={td}>{e.campo ?? "—"}</td>
                      <td className={td}>{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.exitosas > 0 &&
            (hasViajes || hasFacturas || hasClientes || hasTransportistas) && (
              <>
                <div className="flex border-b border-black/10">
                  {(
                    [
                      {
                        key: "viajes",
                        label: `Viajes (${p.viajes?.length ?? 0})`,
                        show: hasViajes,
                      },
                      {
                        key: "facturas",
                        label: `Facturas (${p.facturas?.length ?? 0})`,
                        show: hasFacturas,
                      },
                      {
                        key: "clientes",
                        label: `Clientes (${p.clientes?.length ?? 0})${nuevosClientes > 0 ? ` · ${nuevosClientes} nuevos` : ""}`,
                        show: hasClientes,
                      },
                      {
                        key: "transportistas",
                        label: `Transportistas (${p.transportistas?.length ?? 0})${nuevosTransp > 0 ? ` · ${nuevosTransp} nuevos` : ""}`,
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
                  <ViajesTable viajes={p.viajes!} />
                )}
                {tab === "facturas" && hasFacturas && (
                  <FacturasTable facturas={p.facturas!} />
                )}
                {tab === "clientes" && hasClientes && (
                  <EntidadTable entidades={p.clientes!} />
                )}
                {tab === "transportistas" && hasTransportistas && (
                  <EntidadTable entidades={p.transportistas!} />
                )}
              </>
            )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={wizard.loading || p.exitosas === 0}
              onClick={() => void wizard.confirmarModuloActual()}
              className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
            >
              Confirmar y continuar
            </button>
            <button
              type="button"
              disabled={wizard.loading}
              onClick={wizard.saltearModuloActual}
              className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04]"
            >
              Saltear esta hoja
            </button>
          </div>
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
            ]}
          />
        );
      }}
    />
  );
}

function FacturasTable({ facturas }: { facturas: ImportPreviewFactura[] }) {
  return (
    <ListadoDatos
      columns={[
        {
          id: "numero",
          header: "Número",
          primary: true,
          cell: (f) => f.numero,
        },
        { id: "nombre", header: "Cliente", cell: (f) => f.nombre },
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
            { label: "Cliente", value: f.nombre },
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

function EtapaOpcional<T>({
  titulo,
  descripcion,
  loading,
  preview,
  onPedirPreview,
  onSaltear,
  onConfirmar,
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
  renderTabla: (items: T[] | null) => React.ReactNode;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-[family-name:var(--font-ui)] text-sm font-semibold uppercase tracking-[0.14em] text-vialto-charcoal">
        {titulo}
      </h3>
      <p className="text-sm text-vialto-steel">{descripcion}</p>

      {!preview && (
        <div className="flex gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onPedirPreview}
            className="border border-black/15 bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Ver preview"}
          </button>
          <button
            type="button"
            disabled={loading}
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
            <button
              type="button"
              disabled={loading || preview.length === 0 || confirmDisabled}
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
