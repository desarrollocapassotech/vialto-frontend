import { useEffect, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { abrirAdjuntoEnPestana } from "@/lib/abrirAdjunto";
import { ComprobanteAdjuntoClip } from "@/components/shared/ComprobanteAdjuntoClip";
import { Banknote, Receipt } from "lucide-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { listadoTablaTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import {
  textoRutaViaje,
  etiquetasDestinosDesdeViaje,
} from "@/lib/viajesDestinos";
import type { ViajeCliente } from "@/types/api";
import { OtroGastoAutorDisplay } from "@/components/viajes/OtrosGastosFieldset";
import { useOrgUserLabels } from "@/hooks/useOrgUserLabels";
import type { Viaje } from "@/types/api";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useProductoLabels } from "@/hooks/useProductoLabels";
import {
  etapaViajeBadgeClass,
  etapaViajeBadgeClassDefault,
  etapaViajeLabel,
  facturacionEstadoAgregado,
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  facturacionPermiteVincular,
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipFacturacionEstado,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from "@/lib/viajesIndicadores";
import { ViajeFacturacionIndicador } from "@/components/viajes/ViajeFacturacionIndicador";
import { ViajeLiquidacionIndicador } from "@/components/viajes/ViajeLiquidacionIndicador";
import { ViajePagoTransportistaIndicador } from "@/components/viajes/ViajePagoTransportistaIndicador";
import { numeroVisibleViaje, viajeUsaNumeroInterno } from "@/lib/viajesFlota";
import { Dato, DatosCabecera } from "@/components/shared/DetalleComprobante";
import {
  AccionSeccionViaje,
  BadgeEstadoViaje,
  FilaDetalleViaje,
  SeccionDetalleViaje,
  VerComprobanteAdjunto,
} from "@/components/viajes/ViajeDetalleSecciones";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  canAccessEmisionFacturasArca,
  canAccessEmisionLiquidoProductoArca,
  canAccessFacturacion,
  canAccessLiquidaciones,
} from "@/lib/tenantModules";
import { calcularSaldoTransportista } from "@/lib/viajesTransportistaPagos";
import { nroComprobante } from "@/lib/arcaCbteTipo";

/** Clase de grilla de las secciones según cuántas se muestran (clases fijas para Tailwind). */
const SECCIONES_GRID: Record<number, string> = {
  1: "",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtMonto(monto: number | null | undefined, moneda?: string | null) {
  if (monto == null) return "—";
  const prefix = moneda === "USD" ? "USD " : "$ ";
  return `${prefix}${monto.toLocaleString("es-AR")}`;
}

function rutaClienteAdicional(c: ViajeCliente): string {
  return textoRutaViaje(
    c.origen,
    [...(c.destinosCliente ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .map((d) => d.etiqueta)
      .filter(Boolean),
  );
}

function cargaClienteAdicional(c: ViajeCliente): string {
  const productos = [...(c.productosCliente ?? [])]
    .sort((a, b) => a.orden - b.orden)
    .map((p) => `${p.producto.nombre}${p.cantidad ? ` × ${p.cantidad}` : ""}`)
    .join(", ");
  return productos || "—";
}

export function ViajeViewModal({
  viaje,
  onClose,
  onEditar,
  tenantId,
  hasLiquidoProductoArca = false,
  editando = false,
  onFacturar,
  facturando = false,
  onVerFactura,
  onLiquidar,
  liquidando = false,
  onRegistrarPago,
  modulos,
}: {
  viaje: Viaje;
  /**
   * Módulos de la empresa del viaje. Desde superadmin pasar los de la empresa elegida
   * (`useCurrentTenant()` ahí resuelve la org del superadmin). Si no se pasa se usan los
   * del tenant actual; sin ninguno (superadmin sin dato) se decide por los datos del viaje.
   */
  modulos?: string[] | null;
  onClose: () => void;
  onEditar: () => void;
  onVerFactura?: () => void;
  /** Clerk org id para resolver nombres en vista superadmin. */
  tenantId?: string;
  /** Tenant con módulo emision-liquido-producto-arca activo: define si se muestra el badge de liquidación o el de pago al transportista. */
  hasLiquidoProductoArca?: boolean;
  /** El editor se está preparando (fetch de listas maestras, etc.): bloquea el modal hasta que esté listo. */
  editando?: boolean;
  /** Si se pasa, muestra un botón "Facturar" junto a "Editar" (hoy solo desde el dashboard). */
  onFacturar?: () => void;
  /** El creador de factura se está preparando: bloquea el modal hasta que esté listo. */
  facturando?: boolean;
  /** Si se pasa, muestra un botón "Liquidar" (abre la liquidación electrónica CVLP vía ARCA — hoy solo desde el dashboard). */
  onLiquidar?: () => void;
  /** El registro de pago se está preparando: bloquea el modal hasta que esté listo. */
  liquidando?: boolean;
  /**
   * Si se pasa, el badge de pago al transportista (tenants sin ARCA) se vuelve
   * clickeable y abre "Registrar pago". Distinto de `onLiquidar`, que es la
   * liquidación electrónica vía ARCA.
   */
  onRegistrarPago?: () => void;
}) {
  const userLabelMap = useOrgUserLabels(tenantId);
  const { isVisible } = useFieldConfig("viajes");
  const productoLabelsTenant = useProductoLabels();
  const { tenant: currentTenant } = useCurrentTenant();
  const { getToken } = useAuth();
  /** Comprobante adjunto en pestaña nueva (mismo helper que el resto del sistema). */
  function verAdjunto(url: string | null | undefined) {
    if (url?.trim()) void abrirAdjuntoEnPestana({ url }, () => getToken());
  }
  /** Valor de fila + clip clickeable si el comprobante tiene adjunto. */
  function conAdjunto(abrir: (() => void) | undefined, children: ReactNode) {
    if (!abrir) return <>{children}</>;
    return (
      <span className="inline-flex items-center gap-1.5">
        <ComprobanteAdjuntoClip onClick={abrir} />
        {children}
      </span>
    );
  }
  /**
   * Comprobante de una liquidación: el adjunto si es manual, o el PDF del CVLP que
   * genera la API si se emitió por ARCA (no tiene URL guardada).
   */
  function abrirComprobanteLiquidacion(l: {
    id: string;
    comprobanteUrl?: string | null;
    cbteNro?: number | null;
  }): (() => void) | undefined {
    if (l.comprobanteUrl?.trim()) return () => verAdjunto(l.comprobanteUrl);
    if (l.cbteNro == null) return undefined;
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    const apiPath = `/api/integracion-arca/liquidaciones/${encodeURIComponent(l.id)}/pdf${q}`;
    return () => void abrirAdjuntoEnPestana({ apiPath }, () => getToken(), "Liquidación");
  }
  const mods = modulos ?? currentTenant?.modules ?? null;
  // Mismo criterio que la grilla de Viajes: Facturación (manual o ARCA) y Liquidaciones
  // (registro manual o CVLP por ARCA). Sin módulos conocidos, decide el dato del viaje.
  const tieneFacturacion =
    mods == null ||
    canAccessFacturacion(mods) ||
    canAccessEmisionFacturasArca(mods) ||
    !!viaje.facturaId;
  const tieneLiqArca =
    hasLiquidoProductoArca ||
    (mods != null && canAccessEmisionLiquidoProductoArca(mods));
  const tieneLiquidaciones =
    mods == null
      ? tieneLiqArca || viaje.liquidacionEstado != null
      : tieneLiqArca || canAccessLiquidaciones(mods);
  const bloqueado = editando || facturando || liquidando;
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !bloqueado) onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, bloqueado]);

  const clienteNombre = viaje.cliente?.nombre ?? viaje.clienteId;
  const transportistaNombre =
    viaje.transportista?.nombre ??
    (viaje.transportistaId ? viaje.transportistaId : "—");
  const vehiculoPatentes =
    viaje.vehiculosViaje?.map((v) => v.vehiculo.patente).join(", ") ?? null;
  const productosDesc =
    viaje.productosViaje
      ?.map(
        (p) => `${p.producto.nombre}${p.cantidad ? ` × ${p.cantidad}` : ""}`,
      )
      .join(", ") ?? null;

  // Con más de un cliente en el viaje no hay uno "principal" — se listan todos
  // por igual en una sola tabla (ver "Clientes del viaje" más abajo) en vez de
  // destacar uno arriba y el resto como "otros".
  const clientesExtra = viaje.clientesViaje ?? [];
  const esMultiCliente = clientesExtra.length > 0;
  /** Facturado: el monto a mostrar incluye el IVA de la factura. Sin facturar: neto tal cual. */
  function montoConIva(monto: number | null, ivaPct: number | null, facturado: boolean) {
    if (monto == null) return monto;
    if (!facturado || ivaPct == null) return monto;
    return Math.round(monto * (1 + ivaPct / 100) * 100) / 100;
  }
  const clientesDetalle = esMultiCliente
    ? [
        {
          id: "principal",
          nombre: clienteNombre,
          ruta: textoRutaViaje(
            viaje.origen,
            etiquetasDestinosDesdeViaje(viaje),
          ),
          carga: productosDesc || "—",
          monedaMonto: viaje.monedaMonto ?? null,
          facturado: !facturacionPermiteVincular(viaje.facturacionEstado),
          ivaPct: viaje.factura?.ivaPct ?? null,
          monto: montoConIva(
            viaje.monto,
            viaje.factura?.ivaPct ?? null,
            !facturacionPermiteVincular(viaje.facturacionEstado),
          ),
        },
        ...clientesExtra.map((c) => ({
          id: c.id,
          nombre: c.cliente?.nombre || "—",
          ruta: rutaClienteAdicional(c),
          carga: cargaClienteAdicional(c),
          monedaMonto: c.monedaMonto,
          facturado: !facturacionPermiteVincular(c.facturacionEstado),
          ivaPct: c.factura?.ivaPct ?? null,
          monto: montoConIva(
            c.monto,
            c.factura?.ivaPct ?? null,
            !facturacionPermiteVincular(c.facturacionEstado),
          ),
        })),
      ]
    : [];

  const ver = (key: string) => isVisible("detalle_viaje", key);
  const fechaCargaTxt =
    ver("fechaCarga") && viaje.fechaCarga ? fmtDate(viaje.fechaCarga) : null;
  const fechaDescargaTxt =
    ver("fechaDescarga") && viaje.fechaDescarga
      ? fmtDate(viaje.fechaDescarga)
      : null;
  const montoClienteTxt =
    !esMultiCliente && viaje.monto != null
      ? fmtMonto(viaje.monto, viaje.monedaMonto)
      : null;
  const montoClienteSub =
    viaje.cantidadFactura != null && viaje.precioUnitarioFactura != null
      ? `${viaje.cantidadFactura.toLocaleString("es-AR")} × ${fmtMonto(viaje.precioUnitarioFactura, viaje.monedaMonto)}`
      : undefined;

  /** Datos generales del viaje en el bloque compacto (montos y estados van en sus secciones). */
  const datos: {
    key: string;
    label: string;
    value: string | number | null;
    sub?: string;
    className?: string;
  }[] = [
    ...(esMultiCliente
      ? []
      : [{ key: "clienteId", label: "Cliente", value: clienteNombre }]),
    {
      key: "transportistaId",
      label: "Transportista",
      value: viaje.transportistaId ? transportistaNombre : "Flota propia",
    },
    {
      key: "choferId",
      label: "Chofer",
      value: viaje.chofer?.nombre?.trim() || null,
    },
    ...(esMultiCliente
      ? []
      : [
          {
            key: "origen",
            label: "Ruta",
            value: textoRutaViaje(
              viaje.origen,
              etiquetasDestinosDesdeViaje(viaje),
            ),
          },
        ]),
    // Carga y descarga en un solo dato; si no hay carga, la descarga va sola.
    fechaCargaTxt
      ? {
          key: "fechaCarga",
          label: "Fecha de carga",
          value: fechaCargaTxt,
          sub: fechaDescargaTxt ? `Descarga ${fechaDescargaTxt}` : undefined,
        }
      : { key: "fechaDescarga", label: "Fecha de descarga", value: fechaDescargaTxt },
    { key: "vehiculosRows", label: "Vehículos", value: vehiculoPatentes },
    ...(esMultiCliente
      ? []
      : [{ key: "productoItems", label: productoLabelsTenant.plural, value: productosDesc }]),
    // Sin módulo de facturación no hay sección "Facturación": el monto queda acá.
    ...(tieneFacturacion
      ? []
      : [
          {
            key: "monto",
            label: "Monto cliente",
            value: montoClienteTxt,
            sub: montoClienteSub,
          },
        ]),
  ].filter((c) => c.value != null && c.value !== "" && ver(c.key));

  // ── Estado ───────────────────────────────────────────────────────────────
  const filasEstado = [
    // La etapa (pendiente / en curso / finalizado / cancelado) va siempre: es el dato
    // central de la sección, aunque la empresa oculte su badge en el encabezado.
    viaje.etapa && (
      <FilaDetalleViaje
        key="etapa"
        label="Etapa"
        value={
          <BadgeEstadoViaje
            className={etapaViajeBadgeClass[viaje.etapa] ?? etapaViajeBadgeClassDefault}
          >
            {etapaViajeLabel[viaje.etapa] ?? viaje.etapa}
          </BadgeEstadoViaje>
        }
      />
    ),
    ver("fechaFinalizado") && viaje.fechaFinalizado && (
      <FilaDetalleViaje
        key="fin"
        label="Finalizado"
        value={fmtDate(viaje.fechaFinalizado)}
      />
    ),
    ver("kmRecorridos") && viaje.kmRecorridos != null && (
      <FilaDetalleViaje
        key="km"
        label="KM recorridos"
        value={viaje.kmRecorridos.toLocaleString("es-AR")}
      />
    ),
    ver("litrosConsumidos") && viaje.litrosConsumidos != null && (
      <FilaDetalleViaje
        key="litros"
        label="Litros consumidos"
        value={viaje.litrosConsumidos.toLocaleString("es-AR")}
      />
    ),
  ].filter(Boolean);

  // ── Facturación ──────────────────────────────────────────────────────────
  // Con un solo cliente la factura se abre encima de este modal (como la liquidación).
  // Multi-cliente: el host elige cuál de las facturas abrir (`onVerFactura`).
  const verFacturaOverride = esMultiCliente ? onVerFactura : undefined;
  const estadoFact = facturacionEstadoAgregado(viaje);
  const factura = viaje.factura;
  const nroFactura =
    factura?.cbteNro != null
      ? nroComprobante(factura.ptoVenta, factura.cbteNro)
      : factura?.numero || viaje.nroFactura;
  const totalMultiCliente =
    Object.entries(
      clientesDetalle.reduce<Record<string, number>>((acc, c) => {
        if (c.monto == null) return acc;
        const moneda = c.monedaMonto === "USD" ? "USD" : "ARS";
        acc[moneda] = (acc[moneda] ?? 0) + c.monto;
        return acc;
      }, {}),
    )
      .map(([moneda, total]) => fmtMonto(total, moneda))
      .join(" + ") || "—";
  const filasFacturacion = !tieneFacturacion
    ? []
    : [
        ver("facturacionEstado") && (
          <FilaDetalleViaje
            key="estado"
            label="Estado"
            value={
              <BadgeEstadoViaje className={facturacionEstadoBadgeClass[estadoFact]}>
                {facturacionEstadoLabel[estadoFact]}
              </BadgeEstadoViaje>
            }
            // Error de AFIP / anulada: el texto largo explica qué pasó.
            sub={
              !esMultiCliente &&
              (estadoFact === "error_afip" || estadoFact === "anulado")
                ? tooltipFacturacionEstado(viaje)
                : undefined
            }
            subClassName={
              estadoFact === "error_afip" ? "text-red-700" : "text-vialto-steel"
            }
          />
        ),
        ver("monto") && montoClienteTxt && (
          <FilaDetalleViaje
            key="monto"
            label="Monto cliente"
            value={montoClienteTxt}
            sub={montoClienteSub}
          />
        ),
        ver("facturacionEstado") && !esMultiCliente && nroFactura && (
          <FilaDetalleViaje
            key="factura"
            label="Factura"
            value={conAdjunto(
              factura?.comprobanteUrl?.trim()
                ? () => verAdjunto(factura.comprobanteUrl)
                : undefined,
              `N° ${nroFactura}`,
            )}
            sub={
              <>
                {[
                  factura?.fechaEmision ? `Emitida ${fmtDate(factura.fechaEmision)}` : null,
                  factura?.cae ? `CAE ${factura.cae}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null}
                {factura?.comprobanteUrl?.trim() && (
                  <span className="block">
                    <VerComprobanteAdjunto
                      onClick={() => verAdjunto(factura.comprobanteUrl)}
                    />
                  </span>
                )}
              </>
            }
          />
        ),
        ver("facturacionEstado") &&
          !esMultiCliente &&
          viaje.montoFacturadoReal != null && (
            <FilaDetalleViaje
              key="facturadoReal"
              label="Facturado"
              value={fmtMonto(
                viaje.montoFacturadoReal,
                viaje.monedaMontoFacturadoReal,
              )}
            />
          ),
      ].filter(Boolean);

  // ── Liquidación / pago al transportista ──────────────────────────────────
  const conTransportista = !!viaje.transportistaId;
  const precioTransportistaFila = ver("precioTransportistaExterno") &&
    viaje.precioTransportistaExterno != null && (
      <FilaDetalleViaje
        key="precio"
        label="Precio transportista"
        value={fmtMonto(
          viaje.precioTransportistaExterno,
          viaje.monedaPrecioTransportistaExterno,
        )}
        sub={
          [
            viaje.cantidadTransportista != null &&
            viaje.precioUnitarioTransportista != null
              ? `${viaje.cantidadTransportista.toLocaleString("es-AR")} × ${fmtMonto(viaje.precioUnitarioTransportista, viaje.monedaPrecioTransportistaExterno)}`
              : null,
            ver("precioTransportistaIvaIncluidoPct") &&
            viaje.precioTransportistaIvaIncluidoPct
              ? `+${viaje.precioTransportistaIvaIncluidoPct}% IVA en efectivo`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
    );
  const estadoLiq = viaje.liquidacionEstado as LiquidacionEstado | null;
  const saldoTransportista =
    !tieneLiquidaciones && ver("pagosTransportista")
      ? calcularSaldoTransportista(viaje)
      : null;
  const filasLiquidacion = !conTransportista
    ? []
    : tieneLiquidaciones
      ? [
          // Estado primero, alineado con el de Etapa y Facturación.
          ver("liquidacionEstado") && estadoLiq && (
            <FilaDetalleViaje
              key="estado"
              label="Estado"
              value={
                <BadgeEstadoViaje className={liquidacionEstadoBadgeClass[estadoLiq]}>
                  {liquidacionEstadoLabel[estadoLiq] ?? estadoLiq}
                </BadgeEstadoViaje>
              }
              sub={
                estadoLiq === "error_afip" || estadoLiq === "anulado"
                  ? tooltipLiquidacionEstado(viaje)
                  : undefined
              }
              subClassName={
                estadoLiq === "error_afip" ? "text-red-700" : "text-vialto-steel"
              }
            />
          ),
          precioTransportistaFila,
          // Igual que Facturación: una fila con el comprobante ("Liquidación") y otra con
          // el importe ("Liquidado").
          // Ya liquidado: las liquidaciones anuladas (reemplazadas) no se listan.
          ...(ver("liquidacionEstado") ? viaje.liquidacionesViaje ?? [] : [])
            .filter(
              (lv) =>
                estadoLiq !== "liquidado" ||
                (lv.liquidacion.estado !== "anulado" && !lv.liquidacion.anuladoAt),
            )
            .flatMap(
            (lv) => {
              const l = lv.liquidacion;
              const subComprobante =
                [
                  // Misma fecha que el PDF del CVLP (alta de la liquidación).
                  l.createdAt
                    ? `${l.cbteNro != null ? "Emitida" : "Cargada"} ${fmtDate(l.createdAt)}`
                    : null,
                  l.cae ? `CAE ${l.cae}` : null,
                  l.anuladoAt ? "Anulada" : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null;
              const abrirComprobante = abrirComprobanteLiquidacion(l);
              return [
                <FilaDetalleViaje
                  key={`${lv.liquidacionId}-cbte`}
                  label="Liquidación"
                  value={conAdjunto(
                    abrirComprobante,
                    l.cbteNro != null
                      ? `N° ${nroComprobante(l.ptoVenta, l.cbteNro)}`
                      : "Manual",
                  )}
                  sub={
                    subComprobante || abrirComprobante ? (
                      <>
                        {subComprobante}
                        {abrirComprobante && (
                          <span className="block">
                            <VerComprobanteAdjunto onClick={abrirComprobante} />
                          </span>
                        )}
                      </>
                    ) : undefined
                  }
                />,
                <FilaDetalleViaje
                  key={`${lv.liquidacionId}-monto`}
                  label="Liquidado"
                  value={fmtMonto(lv.monto ?? l.liquido)}
                />,
              ];
            },
          ),
        ].filter(Boolean)
      : [
          precioTransportistaFila,
          saldoTransportista && saldoTransportista.totalAcordado > 0 && (
            <FilaDetalleViaje
              key="pagado"
              label="Pagado"
              value={fmtMonto(saldoTransportista.totalPagado, saldoTransportista.moneda)}
            />
          ),
          saldoTransportista && saldoTransportista.totalAcordado > 0 && (
            <FilaDetalleViaje
              key="saldo"
              label="Saldo"
              value={
                saldoTransportista.pagado ? (
                  <BadgeEstadoViaje className="border-emerald-500/80 bg-emerald-100 text-emerald-950">
                    Pagado
                  </BadgeEstadoViaje>
                ) : (
                  fmtMonto(saldoTransportista.saldo, saldoTransportista.moneda)
                )
              }
            />
          ),
        ].filter(Boolean);

  // El estado va embebido en la cabecera (bloque aparte a la derecha), no como sección.
  const estadoCabecera =
    filasEstado.length > 0 ? (
      <div>
        <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
          Estado
        </p>
        <div className="mt-0.5">{filasEstado}</div>
      </div>
    ) : undefined;

  const secciones = [
    filasFacturacion.length > 0 && (
      <SeccionDetalleViaje
        key="facturacion"
        titulo="Facturación"
        accion={
          !bloqueado && ver("facturacionEstado") ? (
            <ViajeFacturacionIndicador
              viaje={viaje}
              tenantId={tenantId}
              onClickOverride={verFacturaOverride}
              variante="link"
            />
          ) : undefined
        }
      >
        {filasFacturacion}
      </SeccionDetalleViaje>
    ),
    filasLiquidacion.length > 0 && (
      <SeccionDetalleViaje
        key="liquidacion"
        titulo={tieneLiquidaciones ? "Liquidación" : "Pago al transportista"}
        accion={
          tieneLiquidaciones ? (
            !bloqueado && ver("liquidacionEstado") ? (
              <ViajeLiquidacionIndicador
                viaje={viaje}
                tenantId={tenantId}
                hasArca={tieneLiqArca}
                variante="link"
              />
            ) : undefined
          ) : !tieneLiquidaciones &&
          onRegistrarPago &&
          !bloqueado &&
          saldoTransportista &&
          !saldoTransportista.pagado ? (
            <AccionSeccionViaje onClick={onRegistrarPago}>Registrar pago</AccionSeccionViaje>
          ) : undefined
        }
      >
        {filasLiquidacion}
      </SeccionDetalleViaje>
    ),
  ].filter(Boolean);

  return (
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-3">
          <span>Viaje #{numeroVisibleViaje(viaje)}</span>
          {viajeUsaNumeroInterno(viaje) && (
            <span className="text-xs font-normal normal-case tracking-normal text-vialto-steel">
              (número interno generado automáticamente)
            </span>
          )}
          {isVisible("detalle_viaje", "etapa") && (
            <span
              className={`text-xs uppercase tracking-[0.1em] border rounded-sm px-2 py-0.5 ${
                etapaViajeBadgeClass[viaje.etapa] ?? etapaViajeBadgeClassDefault
              }`}
            >
              {etapaViajeLabel[viaje.etapa] ?? viaje.etapa}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            {tieneFacturacion && isVisible("detalle_viaje", "facturacionEstado") && (
              <ViajeFacturacionIndicador viaje={viaje} tenantId={tenantId} onClickOverride={verFacturaOverride} />
            )}
            {isVisible("detalle_viaje", "liquidacionEstado") && (
              tieneLiquidaciones ? (
                <ViajeLiquidacionIndicador
                  viaje={viaje}
                  tenantId={tenantId}
                  hasArca={tieneLiqArca}
                  onRegistrarPago={onRegistrarPago}
                />
              ) : (
                <ViajePagoTransportistaIndicador
                  viaje={viaje}
                  onClick={onRegistrarPago}
                />
              )
            )}
          </span>
        </span>
      }
      onClose={bloqueado ? () => {} : onClose}
      maxWidthClass="sm:max-w-6xl"
      scrollBody
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={bloqueado}
            className={`${viewModalBtnGhost} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Cerrar
          </button>
          {onFacturar && (
            <button
              type="button"
              onClick={onFacturar}
              disabled={bloqueado}
              className={`${viewModalBtnGhost} disabled:cursor-wait disabled:opacity-50`}
            >
              {facturando ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Abriendo…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Receipt
                    className="h-3.5 w-3.5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Facturar
                </span>
              )}
            </button>
          )}
          {onLiquidar && (
            <button
              type="button"
              onClick={onLiquidar}
              disabled={bloqueado}
              className={`${viewModalBtnGhost} disabled:cursor-wait disabled:opacity-50`}
            >
              {liquidando ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Abriendo…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <Banknote
                    className="h-3.5 w-3.5"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  Liquidar
                </span>
              )}
            </button>
          )}
          <span className="group relative inline-block">
            <button
              type="button"
              onClick={onEditar}
              disabled={bloqueado}
              className={`${viewModalBtnPrimary}${bloqueado ? " cursor-wait" : ""}`}
            >
              {editando ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Abriendo…
                </span>
              ) : (
                "Editar"
              )}
            </button>
          </span>
        </>
      }
    >
      <div className="flex flex-col divide-y divide-black/5">
        <div className="flex flex-col gap-4 pb-5">
          {/* Datos generales del viaje en un bloque compacto (igual que Facturas/Liquidaciones). */}
          {(datos.length > 0 || estadoCabecera) && (
            <DatosCabecera aside={estadoCabecera}>
              {datos.map((d) => (
                <Dato
                  key={d.key}
                  label={d.label}
                  value={d.value}
                  sub={d.sub}
                  className={d.className}
                />
              ))}
            </DatosCabecera>
          )}
          {((ver("detalleCarga") && viaje.detalleCarga) ||
            (ver("observaciones") && viaje.observaciones)) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {ver("detalleCarga") && viaje.detalleCarga && (
                <div className="min-w-0">
                  <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
                    Detalle de carga
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-sm">{viaje.detalleCarga}</p>
                </div>
              )}
              {ver("observaciones") && viaje.observaciones && (
                <div className="min-w-0">
                  <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
                    Observaciones
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-sm">{viaje.observaciones}</p>
                </div>
              )}
            </div>
          )}
          {secciones.length > 0 && (
            <div className={`grid items-start gap-4 ${SECCIONES_GRID[secciones.length] ?? ""}`}>
              {secciones}
            </div>
          )}
        </div>

        {esMultiCliente && (
          <div className="py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
              Clientes del viaje
              <span className="ml-2 font-normal normal-case tracking-normal">
                ({clientesDetalle.length})
              </span>
            </p>
            <ListadoDatos
              columns={[
                {
                  id: "cliente",
                  header: "Cliente",
                  primary: true,
                  cell: (c) => c.nombre,
                  tdClassName: listadoTablaTdClass,
                },
                {
                  id: "ruta",
                  header: "Ruta",
                  cell: (c) => c.ruta,
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                },
                {
                  id: "carga",
                  header: "Carga",
                  cell: (c) => c.carga,
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                },
                {
                  id: "facturado",
                  header: "Facturado",
                  cell: (c) =>
                    c.facturado
                      ? `Sí${c.ivaPct != null ? ` (${c.ivaPct}% IVA)` : ""}`
                      : "No",
                  tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
                },
                {
                  id: "monto",
                  header: "Monto",
                  cell: (c) => (
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {c.facturado && c.ivaPct != null && (
                        <span
                          className="rounded-sm border border-black/10 px-1 py-px text-[9px] font-normal uppercase tracking-wide text-vialto-steel"
                          title={`Incluye ${c.ivaPct}% de IVA`}
                        >
                          Con IVA
                        </span>
                      )}
                      {fmtMonto(c.monto, c.monedaMonto)}
                    </span>
                  ),
                  thClassName: `${listadoTablaThClass} text-right`,
                  tdClassName: `${listadoTablaTdClass} text-right tabular-nums whitespace-nowrap font-medium`,
                },
              ]}
              rows={clientesDetalle}
              rowKey={(c) => c.id}
              emptyMessage="Sin clientes."
            />
            <p className="mt-2 text-right text-xs text-vialto-steel">
              Total del viaje: {totalMultiCliente}
            </p>
          </div>
        )}

        {isVisible("detalle_viaje", "otrosGastos") &&
          viaje.otrosGastos &&
          viaje.otrosGastos.length > 0 && (
            <div className="py-5">
              <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
                Gastos adicionales
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({viaje.otrosGastos.length})
                </span>
              </p>
              <ListadoDatos
                columns={[
                  {
                    id: "descripcion",
                    header: "Descripción",
                    primary: true,
                    cell: (g) => g.descripcion || "—",
                    tdClassName: listadoTablaTdClass,
                  },
                  {
                    id: "fecha",
                    header: "Fecha",
                    cell: (g) => fmtDate(g.fecha),
                    tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
                  },
                  {
                    id: "cargadoPor",
                    header: "Cargado por",
                    cell: (g) => (
                      <OtroGastoAutorDisplay
                        row={g}
                        labelMap={userLabelMap}
                        className="max-w-[11rem]"
                      />
                    ),
                    tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                  },
                  {
                    id: "monto",
                    header: "Monto",
                    cell: (g) => fmtMonto(g.monto, g.moneda),
                    thClassName: `${listadoTablaThClass} text-right`,
                    tdClassName: `${listadoTablaTdClass} text-right tabular-nums whitespace-nowrap font-medium`,
                  },
                ]}
                rows={viaje.otrosGastos}
                rowKey={(g) =>
                  `${g.descripcion ?? ""}-${g.fecha ?? ""}-${g.monto ?? ""}`
                }
                emptyMessage="Sin gastos registrados."
              />
            </div>
          )}

        {isVisible("detalle_viaje", "pagosTransportista") &&
          viaje.pagosTransportista &&
          viaje.pagosTransportista.length > 0 && (
            <div className="pt-5">
              <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
                Pagos al transportista
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({viaje.pagosTransportista.length})
                </span>
              </p>
              <ListadoDatos
                columns={[
                  {
                    id: "fecha",
                    header: "Fecha",
                    primary: true,
                    cell: (p) => fmtDate(p.fecha),
                    tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
                  },
                  {
                    id: "metodo",
                    header: "Método",
                    cell: (p) => p.metodo || "—",
                    tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                  },
                  {
                    id: "observaciones",
                    header: "Observaciones",
                    cell: (p) => p.observaciones || "—",
                    tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
                  },
                  {
                    id: "monto",
                    header: "Monto",
                    cell: (p) => fmtMonto(p.monto, p.moneda),
                    thClassName: `${listadoTablaThClass} text-right`,
                    tdClassName: `${listadoTablaTdClass} text-right tabular-nums whitespace-nowrap font-medium`,
                  },
                ]}
                rows={viaje.pagosTransportista}
                rowKey={(p) =>
                  `${p.fecha ?? ""}-${p.metodo ?? ""}-${p.monto ?? ""}`
                }
                emptyMessage="Sin pagos registrados."
              />
            </div>
          )}
      </div>
    </ViewModalShell>
  );
}
