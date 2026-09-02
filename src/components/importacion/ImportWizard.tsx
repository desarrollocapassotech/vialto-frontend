import { useAuth } from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Upload } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { listadoTablaTdClass } from "@/lib/listadoTabla";
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
  type ModuloWizard,
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
interface TenantTieneDatos {
  clientes: boolean;
  transportistas: boolean;
  choferes: boolean;
  vehiculos: boolean;
}

export function ImportWizard({
  tenantId,
  tenantModules,
  backTo,
  templatesTo,
}: ImportWizardProps) {
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const hasFacturasArca = tenantModules.includes("emision-facturas-arca");
  const hasLiquidoProductoArca = tenantModules.includes(
    "emision-liquido-producto-arca",
  );
  const hasFacturacion = tenantModules.includes("facturacion");
  const puedeLiquidaciones = hasFacturacion || hasLiquidoProductoArca;
  const puedeFacturas = hasFacturasArca || hasFacturacion;

  // Un tenant nuevo (sin nada cargado todavía, y sin liquidaciones/facturas
  // que ofrecer) arranca directo con la secuencia completa — es el caso de
  // uso principal. Si ya tiene datos, o si puede generar liquidaciones/
  // facturas al final, se le pregunta primero qué quiere hacer en esta
  // importación, para no forzarlo a pasar por hojas que no le interesan.
  const [tieneDatos, setTieneDatos] = useState<TenantTieneDatos | null>(null);
  const [modulosElegidos, setModulosElegidos] = useState<ModuloWizard[] | null>(
    null,
  );
  // Generar liquidaciones/facturas borrador después de Viajes es opcional y
  // arranca siempre destildado — el usuario lo elige a propósito, no por
  // default. Si no seleccionó nada (selector salteado), queda en false.
  const [postViajesElegido, setPostViajesElegido] = useState<{
    liquidaciones: boolean;
    facturas: boolean;
  }>({ liquidaciones: false, facturas: false });
  // Se incrementa al "Volver a importar" para forzar un re-chequeo de
  // tenant-tiene-datos — después de una corrida puede haber cambiado (ej. se
  // acaban de crear los clientes que antes faltaban).
  const [refetchTieneDatos, setRefetchTieneDatos] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setTieneDatos(null);
    setModulosElegidos(null);
    setPostViajesElegido({ liquidaciones: false, facturas: false });
    (async () => {
      try {
        const data = await apiJson<TenantTieneDatos>(
          `/api/importaciones/tenant-tiene-datos?tenantId=${encodeURIComponent(tenantId)}`,
          getToken,
        );
        if (cancelado) return;
        setTieneDatos(data);
        if (
          !data.clientes &&
          !data.transportistas &&
          !data.choferes &&
          !data.vehiculos &&
          !puedeLiquidaciones &&
          !puedeFacturas
        ) {
          setModulosElegidos([...MODULOS_SECUENCIA]);
        }
      } catch {
        // Si falla la consulta, no bloqueamos el import: se arranca con la secuencia completa.
        if (!cancelado) {
          setTieneDatos({
            clientes: false,
            transportistas: false,
            choferes: false,
            vehiculos: false,
          });
          setModulosElegidos([...MODULOS_SECUENCIA]);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, refetchTieneDatos]);

  const wizard = useImportWizard(
    tenantId,
    modulosElegidos ?? [...MODULOS_SECUENCIA],
    () => getToken(),
  );

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
    setModulosElegidos(null);
    setPostViajesElegido({ liquidaciones: false, facturas: false });
    setRefetchTieneDatos((n) => n + 1);
  }

  if (!tieneDatos) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!modulosElegidos) {
    return (
      <SelectorModulos
        tieneDatos={tieneDatos}
        puedeLiquidaciones={puedeLiquidaciones}
        puedeFacturas={puedeFacturas}
        onElegir={(modulos, postViajes) => {
          setModulosElegidos(modulos);
          setPostViajesElegido(postViajes);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepper wizard={wizard} postViajesElegido={postViajesElegido} />

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
            <button
              type="button"
              onClick={reiniciarImportacion}
              className="mt-3 border border-red-300 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-red-800 hover:bg-red-100"
            >
              Volver a importar
            </button>
          )}
        </div>
      )}

      {wizard.error && !columnasFaltantes && (
        <div className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{wizard.error}</p>
          {!wizard.preview && (
            <button
              type="button"
              onClick={reiniciarImportacion}
              className="mt-3 border border-red-300 bg-white px-4 py-2 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-red-800 hover:bg-red-100"
            >
              Volver a importar
            </button>
          )}
        </div>
      )}

      {!(wizard.error && !wizard.preview) && (
      <div className="border border-black/10 bg-white p-6">
        {wizard.fase === "upload" && (
          <div className="flex flex-col gap-4">
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

      {wizard.fase === "post-liquidaciones" && postViajesElegido.liquidaciones && (
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
          <EtapaOpcional
          titulo="Facturar a clientes"
          descripcion="Se van a agrupar los viajes recién creados por cliente."
          loading={wizard.loading}
          preview={wizard.facturasPreview}
          onPedirPreview={wizard.pedirPreviewFacturas}
          onSaltear={wizard.saltearFacturas}
          onConfirmar={() =>
            wizard.confirmarFacturas(
              hasFacturasArca ? undefined : numerosPorCliente,
            )
          }
          confirmDisabled={
            !hasFacturasArca &&
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
                    {!hasFacturasArca && <th className={th}>N° de factura</th>}
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
                      {!hasFacturasArca && (
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
    </div>
  );
}

/** Etiqueta + hint de "ya tenés N cargados" para cada módulo del selector inicial — Viajes no tiene chequeo propio. */
const MODULOS_SELECTOR: { key: ModuloWizard; tieneDatosKey?: keyof TenantTieneDatos }[] =
  [
    { key: "clientes", tieneDatosKey: "clientes" },
    { key: "transportistas", tieneDatosKey: "transportistas" },
    { key: "choferes", tieneDatosKey: "choferes" },
    { key: "vehiculos", tieneDatosKey: "vehiculos" },
    { key: "viajes" },
  ];

/**
 * Pantalla previa al upload cuando el tenant ya tiene datos cargados: en vez
 * de forzar la secuencia completa (pensada para un tenant nuevo), deja
 * elegir qué hojas importar. Dejar todo tildado equivale al recorrido
 * completo de siempre.
 */
function SelectorModulos({
  tieneDatos,
  puedeLiquidaciones,
  puedeFacturas,
  onElegir,
}: {
  tieneDatos: TenantTieneDatos;
  puedeLiquidaciones: boolean;
  puedeFacturas: boolean;
  onElegir: (
    modulos: ModuloWizard[],
    postViajes: { liquidaciones: boolean; facturas: boolean },
  ) => void;
}) {
  // Por defecto solo quedan tildados Viajes (siempre) y los módulos que
  // todavía no tienen datos cargados — los que ya tienen algo se destildan
  // para no forzar un re-import de lo que ya está, aunque se puedan sumar a mano.
  const [seleccionados, setSeleccionados] = useState<Set<ModuloWizard>>(
    () =>
      new Set(
        MODULOS_SELECTOR.filter(
          ({ key, tieneDatosKey }) =>
            key === "viajes" || !tieneDatosKey || !tieneDatos[tieneDatosKey],
        ).map(({ key }) => key),
      ),
  );
  // Generar liquidaciones/facturas borrador es una acción aparte (no un
  // módulo del Excel) — siempre arranca destildada, el usuario la tiene que
  // elegir a propósito.
  const [liquidacionesSel, setLiquidacionesSel] = useState(false);
  const [facturasSel, setFacturasSel] = useState(false);

  function toggle(modulo: ModuloWizard) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(modulo)) next.delete(modulo);
      else next.add(modulo);
      return next;
    });
  }

  const ordenados = MODULOS_SECUENCIA.filter((m) => seleccionados.has(m));

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <div className="max-w-xl">
        <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-vialto-charcoal">
          ¿Qué querés importar?
        </h2>
      </div>

      <div className="flex w-full max-w-md flex-col divide-y divide-black/10 border border-black/10 bg-white text-left">
        {MODULOS_SELECTOR.map(({ key, tieneDatosKey }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 hover:bg-vialto-mist/60"
          >
            <span className="flex flex-col">
              <span className="font-[family-name:var(--font-ui)] text-sm font-semibold text-vialto-charcoal">
                {labelModulo(key)}
              </span>
              {tieneDatosKey && tieneDatos[tieneDatosKey] && (
                <span className="text-xs text-vialto-steel">
                  Ya tenés datos cargados
                </span>
              )}
            </span>
            <input
              type="checkbox"
              checked={seleccionados.has(key)}
              onChange={() => toggle(key)}
              className="h-5 w-5 shrink-0 accent-vialto-charcoal"
            />
          </label>
        ))}
        {puedeLiquidaciones && (
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 hover:bg-vialto-mist/60">
            <span className="flex flex-col">
              <span className="font-[family-name:var(--font-ui)] text-sm font-semibold text-vialto-charcoal">
                Liquidaciones a transportistas
              </span>
              <span className="text-xs text-vialto-steel">
                Genera un borrador por transportista al terminar viajes.
              </span>
            </span>
            <input
              type="checkbox"
              checked={liquidacionesSel}
              onChange={(e) => setLiquidacionesSel(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-vialto-charcoal"
            />
          </label>
        )}
        {puedeFacturas && (
          <label className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 hover:bg-vialto-mist/60">
            <span className="flex flex-col">
              <span className="font-[family-name:var(--font-ui)] text-sm font-semibold text-vialto-charcoal">
                Facturas a clientes
              </span>
              <span className="text-xs text-vialto-steel">
                Genera un borrador por cliente al terminar viajes.
              </span>
            </span>
            <input
              type="checkbox"
              checked={facturasSel}
              onChange={(e) => setFacturasSel(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-vialto-charcoal"
            />
          </label>
        )}
      </div>

      <button
        type="button"
        disabled={ordenados.length === 0}
        onClick={() =>
          onElegir(ordenados, {
            liquidaciones: liquidacionesSel,
            facturas: facturasSel,
          })
        }
        className="border border-black/15 bg-vialto-charcoal px-8 py-3 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-black disabled:opacity-50"
      >
        Continuar →
      </button>
    </div>
  );
}

function WizardStepper({
  wizard,
  postViajesElegido,
}: {
  wizard: ReturnType<typeof useImportWizard>;
  postViajesElegido: { liquidaciones: boolean; facturas: boolean };
}) {
  // Liquidaciones (y el resto de las etapas opcionales post-viajes) solo son
  // alcanzables si "viajes" está en la secuencia de este import — sin viajes,
  // useImportWizard salta directo a "terminado" (ver avanzarModulo). Mostrar
  // el paso igual, aunque nunca se vaya a visitar, confunde al usuario.
  const tieneViajes = wizard.secuencia.includes("viajes");
  const ofreceLiquidaciones = tieneViajes && postViajesElegido.liquidaciones;

  const pasos = [
    ...wizard.secuencia.map((m) => ({ key: m as string, label: labelModulo(m) })),
    ...(ofreceLiquidaciones
      ? [{ key: "post-liquidaciones", label: "Liquidaciones" }]
      : []),
    // "Resumen" es el paso final genérico (siempre hay uno al terminar
    // Viajes, se hayan generado o no facturas/liquidaciones) — no depende
    // de si el usuario tildó "Facturas a clientes".
    ...(tieneViajes ? [{ key: "post-facturas", label: "Resumen" }] : []),
  ];

  const indiceActual =
    wizard.fase === "upload"
      ? -1
      : wizard.fase === "modulo"
        ? wizard.moduloIndex
        : wizard.fase === "post-liquidaciones"
          ? wizard.secuencia.length
          : wizard.fase === "post-facturas"
            ? wizard.secuencia.length + (ofreceLiquidaciones ? 1 : 0)
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
  const [tablaPage, setTablaPage] = useState(1);
  const TABLA_PAGE_SIZE = tab === "viajes" ? 5 : 10;
  const [confirmarCamposFaltantes, setConfirmarCamposFaltantes] =
    useState(false);
  const [confirmarFacturasDuplicadas, setConfirmarFacturasDuplicadas] =
    useState(false);
  const [ciudadesModalOpen, setCiudadesModalOpen] = useState(false);
  const [detalleModalOpen, setDetalleModalOpen] = useState(false);
  // Cada preview nuevo (nuevo módulo, o "reintentar" tras crear entidades
  // faltantes) trae su propia sesión — no arrastrar una confirmación vieja.
  useEffect(() => {
    setConfirmarCamposFaltantes(false);
    setConfirmarFacturasDuplicadas(false);
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
  // Los errores de lookup de un módulo no elegido ya se explican arriba
  // (panel ámbar de "no se importan"), no hace falta duplicarlos acá abajo
  // como si fueran un error bloqueante más.
  const detalleErroresMostrados = (p?.detalleErrores ?? []).filter(
    (e) => !e.lookupModel || moduloElegido(e.lookupModel),
  );
  // `p.errores` cuenta errores individuales (una fila puede fallar por
  // varios campos a la vez, ej. cliente Y transportista Y chofer), no filas
  // — para el stat box usamos filas distintas, que es lo que dice la etiqueta.
  const filasConError = new Set(
    (p?.detalleErrores ?? []).map((e) => e.fila),
  ).size;

  const hasViajes = (p?.viajes?.length ?? 0) > 0;
  const hasFacturas = (p?.facturas?.length ?? 0) > 0;
  // El preview de Viajes siempre trae los clientes/transportistas que
  // referencia (para marcar cuáles son nuevos), pero si el usuario no eligió
  // importar esos módulos en esta corrida no tiene sentido mostrarlos como
  // si fueran parte de lo que se está por guardar.
  const hasClientes =
    wizard.secuencia.includes("clientes") && (p?.clientes?.length ?? 0) > 0;
  const hasTransportistas =
    wizard.secuencia.includes("transportistas") &&
    (p?.transportistas?.length ?? 0) > 0;
  const advertenciasCiudad = p?.advertenciasCiudad ?? [];
  const totalAdvertenciasCiudad =
    p?.totalAdvertenciasCiudad ?? advertenciasCiudad.length;
  const nuevosClientes = p?.clientes?.filter((c) => c.esNuevo).length ?? 0;
  const nuevosTransp =
    p?.transportistas?.filter((t) => t.esNuevo).length ?? 0;
  const advertenciasCamposFaltantes = p?.advertenciasCamposFaltantes ?? [];
  const camposFaltantesUnicos = Array.from(
    new Set(advertenciasCamposFaltantes.flatMap((a) => a.campos)),
  );
  const requiereConfirmarCamposFaltantes =
    advertenciasCamposFaltantes.length > 0 && !confirmarCamposFaltantes;
  const requiereResolverCiudades = advertenciasCiudad.length > 0;
  const advertenciasFacturasDuplicadas =
    p?.advertenciasFacturasDuplicadas ?? [];
  const requiereConfirmarFacturasDuplicadas =
    advertenciasFacturasDuplicadas.length > 0 && !confirmarFacturasDuplicadas;
  const tieneDesgloseActualizacion =
    p != null &&
    p.entidadesNuevas != null &&
    p.entidadesActualizadas != null &&
    p.entidadesActualizadas > 0;

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
            className={`grid gap-2 ${hasViajes ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"}`}
          >
            <StatBox label="Filas en el Excel" value={p.totalFilas} />
            {hasFacturas && (
              <StatBox label="Facturas" value={p.facturas?.length ?? 0} />
            )}
            <StatBox
              label="Filas con error"
              value={filasConError}
              highlight={filasConError > 0 ? "error" : undefined}
            />
            {hasViajes && (
              <StatBox
                label="Adv. ciudades"
                value={totalAdvertenciasCiudad}
                highlight={totalAdvertenciasCiudad > 0 ? "warn" : undefined}
              />
            )}
            <StatBox
              label={
                tieneDesgloseActualizacion
                  ? `${labelModulo(wizard.moduloActual ?? "")} a importar`
                  : `${labelModulo(wizard.moduloActual ?? "")} a crear`
              }
              value={p.exitosas}
              highlight="ok"
              caption={
                tieneDesgloseActualizacion
                  ? `${p.entidadesNuevas} nuevas · ${p.entidadesActualizadas} a actualizar`
                  : undefined
              }
            />
          </div>

          {p.headersNoMapeados.length > 0 && (
            <details className="group border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <summary className="cursor-pointer list-none marker:hidden">
                <span className="font-medium">
                  {p.headersNoMapeados.length} columna
                  {p.headersNoMapeados.length !== 1 ? "s" : ""} del Excel sin
                  usar
                </span>{" "}
                <span className="text-blue-700/70">
                  — no bloquean la importación
                </span>
                <span className="ml-1 inline-block transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="mt-1.5">{p.headersNoMapeados.join(", ")}</p>
            </details>
          )}

          {p.columnasOpcionalesFaltantes.length > 0 && (
            <details className="group border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <summary className="cursor-pointer list-none marker:hidden">
                <span className="font-medium">
                  {p.columnasOpcionalesFaltantes.length} columna
                  {p.columnasOpcionalesFaltantes.length !== 1 ? "s" : ""} del
                  template no encontrada
                  {p.columnasOpcionalesFaltantes.length !== 1 ? "s" : ""} en
                  el Excel
                </span>
                <span className="ml-1 inline-block transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <p className="mt-1.5">
                {p.columnasOpcionalesFaltantes.join(", ")}
              </p>
            </details>
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

          {entidadesFaltantesSinModulo.map((grupo) => {
            const filas = filasSinImportarPor(grupo.modelo);
            return (
              <div
                key={grupo.modelo}
                className="flex flex-col gap-1.5 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
              >
                <p>
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
                </p>
                {filas.length > 0 && (
                  <p className="text-amber-800">
                    Fila{filas.length !== 1 ? "s" : ""}: {filas.join(", ")}.
                  </p>
                )}
                <p className="text-amber-800">
                  Para incluirlas, volvé a empezar y tildá{" "}
                  {labelModulo(grupo.modelo)} en el selector, o cargá esos
                  registros a mano antes de importar Viajes.
                </p>
              </div>
            );
          })}

          {advertenciasCamposFaltantes.length > 0 && (
            <div className="space-y-2.5 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <p>
                <strong>{advertenciasCamposFaltantes.length}</strong> fila
                {advertenciasCamposFaltantes.length !== 1 ? "s" : ""} sin{" "}
                <strong>{camposFaltantesUnicos.join(", ")}</strong> — se
                puede completar después a mano.
              </p>
              <label className="flex items-center justify-end gap-2.5 border-t border-amber-200 pt-2.5 text-sm font-semibold text-amber-900">
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
            </div>
          )}

          {advertenciasFacturasDuplicadas.length > 0 && (
            <div className="space-y-2.5 border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <p>
                <strong>{advertenciasFacturasDuplicadas.length}</strong>{" "}
                número{advertenciasFacturasDuplicadas.length !== 1 ? "s" : ""}{" "}
                de factura repetido
                {advertenciasFacturasDuplicadas.length !== 1 ? "s" : ""} entre
                varios viajes nuevos:{" "}
                <strong>
                  {advertenciasFacturasDuplicadas
                    .map((d) => d.numero)
                    .join(", ")}
                </strong>
                . Se van a unificar en una sola factura por número (sumando
                el importe), en vez de crear una factura duplicada por cada
                viaje.
              </p>
              <label className="flex items-center justify-end gap-2.5 border-t border-amber-200 pt-2.5 text-sm font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={confirmarFacturasDuplicadas}
                  onChange={(e) =>
                    setConfirmarFacturasDuplicadas(e.target.checked)
                  }
                  className="h-5 w-5 accent-vialto-charcoal"
                />
                Entiendo, unificar estas facturas
              </label>
            </div>
          )}

          {detalleErroresMostrados.length > 0 && (
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
          )}

          {p.exitosas > 0 &&
            (hasViajes || hasFacturas || hasClientes || hasTransportistas) && (
              <button
                type="button"
                onClick={() => setDetalleModalOpen(true)}
                className="self-end border border-vialto-charcoal bg-vialto-charcoal px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-sm hover:bg-black"
              >
                Ver cambios →
              </button>
            )}
        </fieldset>
      )}
      {p && (
        <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={wizard.loading}
              onClick={wizard.saltearModuloActual}
              className="border border-black/15 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] text-vialto-steel hover:bg-black/[0.04] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Saltear esta hoja
            </button>
            <button
              type="button"
              disabled={
                wizard.loading ||
                p.exitosas === 0 ||
                requiereConfirmarCamposFaltantes ||
                requiereResolverCiudades ||
                requiereConfirmarFacturasDuplicadas
              }
              onClick={() =>
                void wizard.confirmarModuloActual(
                  confirmarCamposFaltantes,
                  confirmarFacturasDuplicadas,
                )
              }
              title={
                requiereResolverCiudades
                  ? "Resolvé las ciudades pendientes para continuar"
                  : requiereConfirmarCamposFaltantes ||
                      requiereConfirmarFacturasDuplicadas
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

      {p && detalleModalOpen && (
        <div
          className={modalEditOverlayClass}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetalleModalOpen(false);
          }}
        >
          <div className={modalEditPanelClass}>
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-3">
              <h2 className="font-[family-name:var(--font-display)] text-lg tracking-wide text-vialto-charcoal">
                Detalle de filas
              </h2>
              <button
                type="button"
                onClick={() => setDetalleModalOpen(false)}
                className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none px-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
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
                      onClick={() => {
                        setTab(key);
                        setTablaPage(1);
                      }}
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

              {(() => {
                const items: unknown[] =
                  (tab === "viajes" && hasViajes && p.viajes) ||
                  (tab === "facturas" && hasFacturas && p.facturas) ||
                  (tab === "clientes" && hasClientes && p.clientes) ||
                  (tab === "transportistas" &&
                    hasTransportistas &&
                    p.transportistas) ||
                  [];
                const meta = metaPaginacionCliente(
                  items.length,
                  tablaPage,
                  TABLA_PAGE_SIZE,
                );
                return (
                  <>
                    <div className="mt-2 overflow-x-auto">
                      {tab === "viajes" && hasViajes && (
                        <ViajesCambiosList
                          viajes={slicePaginaCliente(
                            p.viajes!,
                            tablaPage,
                            TABLA_PAGE_SIZE,
                          )}
                        />
                      )}
                      {tab === "facturas" && hasFacturas && (
                        <FacturasTable
                          facturas={slicePaginaCliente(
                            p.facturas!,
                            tablaPage,
                            TABLA_PAGE_SIZE,
                          )}
                        />
                      )}
                      {tab === "clientes" && hasClientes && (
                        <EntidadTable
                          entidades={slicePaginaCliente(
                            p.clientes!,
                            tablaPage,
                            TABLA_PAGE_SIZE,
                          )}
                        />
                      )}
                      {tab === "transportistas" && hasTransportistas && (
                        <EntidadTable
                          entidades={slicePaginaCliente(
                            p.transportistas!,
                            tablaPage,
                            TABLA_PAGE_SIZE,
                          )}
                        />
                      )}
                    </div>
                    {meta.totalPages > 1 && (
                      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                        <span className="text-vialto-steel">
                          Página {meta.page} de {meta.totalPages} ·{" "}
                          {meta.total} filas
                        </span>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={!meta.hasPrev}
                            onClick={() =>
                              setTablaPage((p) => Math.max(1, p - 1))
                            }
                            className="h-8 min-w-8 border border-black/20 px-2 text-xs uppercase tracking-wider hover:bg-vialto-mist/80 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Anterior
                          </button>
                          {paginasVisibles(meta.page, meta.totalPages).map(
                            (n) => (
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
                            ),
                          )}
                          <button
                            type="button"
                            disabled={!meta.hasNext}
                            onClick={() =>
                              setTablaPage((p) => Math.min(meta.totalPages, p + 1))
                            }
                            className="h-8 min-w-8 border border-black/20 px-2 text-xs uppercase tracking-wider hover:bg-vialto-mist/80 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
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

function ViajesCambiosList({ viajes }: { viajes: ImportPreviewViaje[] }) {
  const fmt = (v: unknown) => (v != null && v !== "" ? String(v) : "—");

  if (viajes.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-vialto-steel">
        No hay viajes en esta página.
      </p>
    );
  }

  return (
    <div className="divide-y divide-black/10 border border-black/10">
      {viajes.map((v) => (
        <div key={v.fila} className="px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-vialto-charcoal">
              Fila {v.fila} · {fmt(v.cliente)}
            </p>
            {v.nuevo ? (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green-700">
                Nuevo
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                Actualiza
              </span>
            )}
          </div>

          {v.advertenciasCiudad && v.advertenciasCiudad.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-700">
              ⚠ Tiene ciudad sin confirmar — revisala en "Revisar ciudades".
            </p>
          )}

          {v.nuevo ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
              {CAMPOS_VIAJE_MOSTRAR.filter(
                (c) => v[c.key] != null && v[c.key] !== "",
              ).map((c) => (
                <div key={c.key}>
                  <dt className="text-[10px] uppercase tracking-wider text-vialto-steel">
                    {c.label}
                  </dt>
                  <dd className="text-vialto-charcoal">{fmt(v[c.key])}</dd>
                </div>
              ))}
            </dl>
          ) : v.cambios && v.cambios.length > 0 ? (
            <div className="mt-2 space-y-1">
              {v.cambios.map((c, i) => (
                <div key={i} className="text-xs">
                  <span className="font-medium text-vialto-charcoal">
                    {c.campo}:
                  </span>{" "}
                  <span className="text-vialto-steel line-through decoration-red-400">
                    {fmt(c.antes)}
                  </span>
                  <span className="mx-1 text-vialto-steel">→</span>
                  <span className="font-medium text-vialto-charcoal">
                    {fmt(c.despues)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-vialto-steel">Sin cambios.</p>
          )}
        </div>
      ))}
    </div>
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
