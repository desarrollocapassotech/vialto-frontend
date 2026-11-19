import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useNavigate } from "react-router-dom";
import { Eye, FileText, HandCoins } from "lucide-react";
import type { ReactNode } from "react";
import type { useTenantOwnerDashboard } from "@/hooks/useTenantOwnerDashboard";
import type { useMantenimientoDashboard } from "@/hooks/useMantenimientoDashboard";
import type {
  useCombustibleDashboard,
  useFinancieroDashboard,
  useTableroCuentaCorriente,
} from "@/hooks/useDashboardFuentes";
import { bloqueDashboard } from "@/lib/dashboardBloques";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import { formatCurrencyArFromNumber } from "@/lib/currencyMask";
import { soloCiudadDesdeEtiquetaUbicacion } from "@/lib/ciudades/soloCiudadDesdeEtiqueta";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import type { MetricCompare } from "@/types/ownerDashboard";
import type { CombustibleDashboardResponse } from "@/types/combustibleDashboard";
import type { TableroItem } from "@/lib/cuentaCorriente";
import { formatMoney, formatMoneyUSD } from "@/lib/dashboardFormato";
import { MetricCard } from "./DashboardMetricCard";
import { DashboardPendientes, DashboardPendientesMarco } from "./DashboardPendientes";
import { ProximosVencimientosLista } from "@/components/mantenimiento/ProximosVencimientosLista";
import { TableroCuentaCorriente } from "@/components/cuenta-corriente/TableroCuentaCorriente";
import {
  FacturacionPanel,
  LiquidacionesPanel,
  MargenPorClienteTable,
  MargenPorRutaTable,
  MargenPorTransportistaTable,
  MargenResumenPanel,
  ViajesFunnelPanel,
} from "@/components/financiero/FinancieroDashboardPanels";
import {
  AlertasList,
  ChoferRankingTable,
  DistribucionPanel,
  ResumenPanel,
  VehiculoRankingTable,
  ViajesCruceTable,
  fmtFormaPagoClave,
} from "@/components/combustible/CombustibleDashboardPanels";

/** Todo lo que necesitan los bloques; cada fuente viene vacía si ningún bloque la usa. */
export type DashboardDatos = {
  tenantId: string;
  dash: ReturnType<typeof useTenantOwnerDashboard>;
  financiero: ReturnType<typeof useFinancieroDashboard>;
  combustible: ReturnType<typeof useCombustibleDashboard>;
  cuentaCorriente: ReturnType<typeof useTableroCuentaCorriente>;
  mantenimiento: ReturnType<typeof useMantenimientoDashboard>;
  rango: { from: string; to: string } | null;
  onViewViaje?: (id: string) => void;
  loadingViajeId?: string | null;
  onViewFactura?: (id: string) => void;
  loadingFacturaId?: string | null;
};

/** Totales de Cuenta corriente ({ moneda, total }[]) como métrica de tarjeta ARS/USD. */
function metricaDeTotales(totales: { moneda: string; total: number }[] | undefined): MetricCompare {
  const ARS = totales?.find((t) => t.moneda === "ARS")?.total ?? 0;
  const USD = totales?.find((t) => t.moneda === "USD")?.total ?? 0;
  return { current: ARS + USD, previous: 0, changePct: null, sentiment: "neutral", currencies: { ARS, USD } };
}

function metricaSimple(valor: number | undefined): MetricCompare {
  return { current: valor ?? 0, previous: 0, changePct: null, sentiment: "neutral" };
}

/** Gasto del período con su variación (subir el gasto es malo). */
function metricaGastoCombustible(data: CombustibleDashboardResponse | null): MetricCompare {
  const cambio = data?.costoTotalPeriodo?.changePct ?? null;
  return {
    current: data?.totalImporte ?? 0,
    previous: cambio == null ? 0 : 1,
    changePct: cambio,
    sentiment: cambio == null || cambio === 0 ? "neutral" : cambio > 0 ? "negative" : "positive",
  };
}

function TituloAnalisis({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function SubtituloTabla({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
      {children}
    </p>
  );
}

export function DashboardBloque({ id, datos }: { id: string; datos: DashboardDatos }) {
  const navigate = useNavigate();
  const def = bloqueDashboard(id);
  if (!def) return null;
  const { dash, financiero, combustible, cuentaCorriente: cc, mantenimiento: mant } = datos;
  const fin = dash.data?.financiero;
  // Las cargas del mismo período que se está viendo en el panel.
  const linkCombustible = datos.rango
    ? `/combustible?${new URLSearchParams({ from: datos.rango.from, to: datos.rango.to }).toString()}`
    : "/combustible";
  // Facturas emitidas en el período del panel (todas, cobradas o no).
  const linkFacturado = datos.rango
    ? `/facturacion?${new URLSearchParams({ desde: datos.rango.from, hasta: datos.rango.to }).toString()}`
    : "/facturacion";

  const verViaje = (viajeId: string): AccionOpcion[] => {
    const cargando = datos.loadingViajeId === viajeId;
    return [
      {
        id: "ver",
        label: cargando ? "Cargando…" : "Ver viaje",
        icon: Eye,
        disabled: cargando,
        onClick: () =>
          datos.onViewViaje
            ? datos.onViewViaje(viajeId)
            : navigate(`/viajes?viaje=${encodeURIComponent(viajeId)}`),
      },
    ];
  };

  switch (id) {
    // ── Tarjetas ────────────────────────────────────────────────────────
    case "facturado":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={fin?.facturado} loading={dash.loading} linkTo={linkFacturado} />
      );
    case "cobrado":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={fin?.cobrado} loading={dash.loading} valueTone="positiveCash" linkTo="/facturacion?estado=cobrado" />
      );
    case "sin-facturar":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={fin?.sinFacturarPeriodo} loading={dash.loading} valueTone="warn" linkTo="/viajes?facturacion=sin_facturar" />
      );
    case "a-pagar-transportistas":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={fin?.aPagarTransportistas} loading={dash.loading} valueTone="payable" linkTo="/viajes?pagoTransportista=pendiente" />
      );
    case "margen":
      return <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={fin?.margen} loading={dash.loading} linkTo="/viajes" />;
    case "viajes-en-curso":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} simpleCount={dash.data?.viajes?.enCurso.current ?? 0} loading={dash.loading} linkTo="/viajes?etapa=en_curso" />
      );
    case "viajes-finalizados":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} simpleCount={dash.data?.viajes?.completados.current ?? 0} loading={dash.loading} linkTo="/viajes?etapa=finalizado" />
      );
    case "por-cobrar":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={metricaDeTotales(cc.data?.totales.porCobrarPendiente)} loading={cc.esperando} valueTone="positiveCash" linkTo="/cuenta-corriente" />
      );
    case "por-pagar":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={metricaDeTotales(cc.data?.totales.porPagarPendiente)} loading={cc.esperando} valueTone="payable" linkTo="/cuenta-corriente?tipo=proveedor" />
      );
    case "combustible-gasto":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={metricaGastoCombustible(combustible.data)} loading={combustible.esperando} linkTo={linkCombustible} />
      );
    case "combustible-precio-litro":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} metric={metricaSimple(combustible.data?.precioPorLitro)} loading={combustible.esperando} linkTo={linkCombustible} />
      );
    case "stock-ingresos":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} simpleCount={dash.data?.stock?.ingresosHoy ?? 0} loading={dash.loading} valueTone="positiveCash" linkTo="/stock/ingresos/historial" />
      );
    case "stock-egresos":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} simpleCount={dash.data?.stock?.egresosHoy ?? 0} loading={dash.loading} valueTone="payable" linkTo="/stock/egresos/historial" />
      );
    case "mantenimiento-vencidos":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} simpleCount={mant.contadores.vencido} loading={mant.loading} valueTone="payable" linkTo="/mantenimiento?tab=vencimientos&estado=vencido" />
      );
    case "mantenimiento-proximos":
      return (
        <MetricCard title={def.label} tooltip={def.ayuda} icon={def.icono} textoCero={def.textoCero} simpleCount={mant.contadores.proximo} loading={mant.loading} valueTone="warn" linkTo="/mantenimiento?tab=vencimientos&estado=proximo" />
      );

    // ── Pendientes ──────────────────────────────────────────────────────
    case "pendientes-facturas-vencidas": {
      const bloque = dash.data?.alertas?.facturasVencidas;
      return (
        <DashboardPendientes
          titulo={def.label}
          cantidad={bloque?.cantidad ?? 0}
          icono={def.icono}
          tono="alerta"
          montos={bloque?.montosPorMoneda}
          etiquetaMontos="Saldo vencido sin cobrar"
          verTodoTo="/facturacion?cobro=vencida"
          columnas={[{ titulo: "Factura" }]}
          loading={dash.loading && !dash.data}
          vacio="No hay facturas vencidas sin cobrar."
          filas={(bloque?.items ?? []).map((f) => {
            const cargando = datos.loadingFacturaId === f.id;
            return {
              id: f.id,
              celdas: [f.numero.trim() || f.id.slice(0, 8)],
              orden: [f.numero.trim() || f.id],
              acciones: [
                {
                  id: "ver",
                  label: cargando ? "Cargando…" : "Ver factura",
                  icon: FileText,
                  disabled: cargando,
                  onClick: () =>
                    datos.onViewFactura
                      ? datos.onViewFactura(f.id)
                      : navigate(`/facturacion?factura=${encodeURIComponent(f.id)}`),
                },
              ],
            };
          })}
        />
      );
    }
    case "pendientes-viajes-sin-facturar": {
      const bloque = dash.data?.alertas?.viajesSinFactura;
      return (
        <DashboardPendientes
          titulo={def.label}
          cantidad={bloque?.cantidad ?? 0}
          icono={def.icono}
          montos={bloque?.montosPorMoneda}
          etiquetaMontos="Monto a facturar"
          verTodoTo="/viajes?etapa=finalizado"
          columnas={[{ titulo: "Fecha", tipo: "fecha" }, { titulo: "Cliente" }, { titulo: "Ruta" }]}
          loading={dash.loading && !dash.data}
          vacio="No hay viajes finalizados sin facturar."
          filas={(bloque?.items ?? []).map((v) => ({
            id: v.id,
            celdas: [
              v.fecha ? fmtDateUtc(v.fecha) : "—",
              v.clienteNombre ?? "—",
              v.origen || v.destino
                ? `${soloCiudadDesdeEtiquetaUbicacion(v.origen)} → ${soloCiudadDesdeEtiquetaUbicacion(v.destino)}`
                : "—",
            ],
            orden: [v.fecha, v.clienteNombre, v.origen ?? v.destino],
            acciones: verViaje(v.id),
          }))}
        />
      );
    }
    case "pendientes-viajes-sin-liquidar": {
      const bloque = financiero.data?.viajesFunnel?.sinLiquidar;
      return (
        <DashboardPendientes
          titulo={def.label}
          cantidad={bloque?.cantidad ?? 0}
          icono={def.icono}
          montos={bloque?.montoPendiente}
          etiquetaMontos="Monto a liquidar"
          verTodoTo="/viajes?etapa=finalizado"
          columnas={[{ titulo: "Viaje" }, { titulo: "Transportista" }]}
          loading={financiero.esperando}
          vacio="No hay viajes pendientes de liquidar."
          filas={(bloque?.items ?? []).map((v) => ({
            id: v.id,
            celdas: [v.numero || v.id.slice(0, 8), v.transportistaNombre ?? "—"],
            orden: [v.numero || v.id, v.transportistaNombre],
            acciones: verViaje(v.id),
          }))}
        />
      );
    }
    case "pendientes-margen-bajo": {
      const alertas = financiero.data?.margen?.alertas ?? [];
      return (
        <DashboardPendientes
          titulo={def.label}
          icono={def.icono}
          tono="alerta"
          cantidad={alertas.length}
          columnas={[{ titulo: "Viaje" }, { titulo: "Cliente" }, { titulo: "Margen", tipo: "numero" }]}
          loading={financiero.esperando}
          vacio="No hay viajes con margen bajo en el período."
          filas={alertas.map((a) => ({
            id: a.viajeId,
            celdas: [
              a.numero || a.viajeId.slice(0, 8),
              a.clienteNombre,
              <span className={a.margen < 0 ? "text-rose-600" : "text-amber-700"}>
                {a.moneda === "USD" ? formatMoneyUSD(a.margen) : formatMoney(a.margen)}
              </span>,
            ],
            orden: [a.numero || a.viajeId, a.clienteNombre, a.margen],
            acciones: verViaje(a.viajeId),
          }))}
        />
      );
    }
    case "pendientes-cuenta-corriente": {
      const vencidos = cc.data?.vencidos;
      const proximos = cc.data?.proximosVencimientos;
      const marcar = (items: TableroItem[] | undefined, lado: string, vencido: boolean) =>
        (items ?? []).map((it) => ({ it, lado, vencido }));
      const items = [
        ...marcar(vencidos?.cobrar, "A cobrar", true),
        ...marcar(vencidos?.pagar, "A pagar", true),
        ...marcar(proximos?.cobrar, "A cobrar", false),
        ...marcar(proximos?.pagar, "A pagar", false),
      ];
      return (
        <DashboardPendientes
          titulo={def.label}
          icono={def.icono}
          cantidad={items.length}
          verTodoTo="/cuenta-corriente"
          columnas={[{ titulo: "Cuenta" }, { titulo: "Vence", tipo: "fecha" }, { titulo: "Pendiente", tipo: "numero" }]}
          loading={cc.esperando}
          vacio="No hay comprobantes vencidos ni por vencer."
          filas={items.map(({ it, lado, vencido }) => ({
            id: it.id,
            celdas: [
              <span>
                {it.contraparteNombre ?? "—"}
                <span className="ml-1.5 text-xs text-vialto-steel">{lado}</span>
              </span>,
              <span className={vencido ? "text-red-700" : "text-amber-800"}>
                {it.fechaVencimiento ? fmtDateUtc(it.fechaVencimiento) : "—"}
              </span>,
              <span className="tabular-nums">
                {formatCurrencyArFromNumber(it.pendiente)} {it.moneda}
              </span>,
            ],
            orden: [it.contraparteNombre, it.fechaVencimiento, it.pendiente],
            acciones: [
              {
                id: "ver",
                label: "Ver cuenta",
                icon: HandCoins,
                onClick: () =>
                  navigate(
                    `/cuenta-corriente?tipo=${it.tipoContraparte}&id=${encodeURIComponent(it.contraparteId)}`,
                  ),
              },
            ],
          }))}
        />
      );
    }
    case "pendientes-mantenimiento":
      return mant.error ? (
        <DashboardPendientesMarco titulo={def.label} icono={def.icono}>
          <p className="px-4 py-6 text-sm text-vialto-steel">No se pudieron cargar los vencimientos.</p>
        </DashboardPendientesMarco>
      ) : mant.loading ? (
        <DashboardPendientesMarco titulo={def.label} icono={def.icono}>
          <CargandoVialto mensaje="Cargando vencimientos…" chico />
        </DashboardPendientesMarco>
      ) : (
        <DashboardPendientesMarco
          titulo={def.label}
          icono={def.icono}
          tono={mant.proximos.some((f) => f.estado === "vencido") ? "alerta" : "aviso"}
          cantidad={mant.proximos.length}
          verTodoTo={(mant.filas?.length ?? 0) > 0 ? "/mantenimiento?tab=vencimientos" : undefined}
        >
          <ProximosVencimientosLista filas={mant.proximos} hayPlanes={(mant.filas?.length ?? 0) > 0} sinMarco />
        </DashboardPendientesMarco>
      );
    case "pendientes-combustible":
      return (
        <TituloAnalisis titulo={def.label}>
          {combustible.data ? (
            <AlertasList
              alertas={combustible.data.alertas ?? []}
              erroresSincronizacion={combustible.data.erroresSincronizacion ?? []}
              tenantId={datos.tenantId}
            />
          ) : (
            <CargandoVialto mensaje="Cargando alertas de combustible…" chico />
          )}
        </TituloAnalisis>
      );

    // ── Análisis ────────────────────────────────────────────────────────
    case "analisis-margen": {
      const m = financiero.data?.margen;
      return (
        <TituloAnalisis titulo={def.label}>
          <div className="flex flex-col gap-4">
            <MargenResumenPanel data={financiero.data} loading={financiero.loading} />
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <SubtituloTabla>Por cliente</SubtituloTabla>
                <MargenPorClienteTable items={m?.porCliente ?? []} />
              </div>
              <div>
                <SubtituloTabla>Por transportista</SubtituloTabla>
                <MargenPorTransportistaTable items={m?.porTransportista ?? []} />
              </div>
              <div>
                <SubtituloTabla>Por ruta</SubtituloTabla>
                <MargenPorRutaTable items={m?.porRuta ?? []} columnaClave="Ruta" />
              </div>
              <div>
                <SubtituloTabla>Por tipo de carga</SubtituloTabla>
                <MargenPorRutaTable items={m?.porTipoCarga ?? []} columnaClave="Tipo de carga" />
              </div>
            </div>
          </div>
        </TituloAnalisis>
      );
    }
    case "analisis-viajes":
      return (
        <TituloAnalisis titulo={def.label}>
          <ViajesFunnelPanel
            data={financiero.data}
            loading={financiero.esperando}
            onViewViaje={datos.onViewViaje}
            loadingViajeId={datos.loadingViajeId}
          />
        </TituloAnalisis>
      );
    case "analisis-facturacion":
      return (
        <TituloAnalisis titulo={def.label}>
          <FacturacionPanel data={financiero.data} loading={financiero.esperando} />
        </TituloAnalisis>
      );
    case "analisis-liquidaciones":
      return (
        <TituloAnalisis titulo={def.label}>
          <LiquidacionesPanel data={financiero.data} loading={financiero.esperando} />
        </TituloAnalisis>
      );
    case "analisis-cuenta-corriente":
      return (
        <TituloAnalisis titulo={def.label}>
          <TableroCuentaCorriente
            desde={datos.rango?.from}
            hasta={datos.rango?.to}
            onSeleccionarContraparte={(tipo, contraparteId) =>
              navigate(`/cuenta-corriente?tipo=${tipo}&id=${encodeURIComponent(contraparteId)}`)
            }
          />
        </TituloAnalisis>
      );
    case "analisis-combustible":
      return (
        <TituloAnalisis titulo={def.label}>
          <ResumenPanel data={combustible.data} loading={combustible.esperando} />
        </TituloAnalisis>
      );
    case "analisis-combustible-vehiculos":
      return (
        <TituloAnalisis titulo={def.label}>
          <VehiculoRankingTable items={combustible.data?.porVehiculo ?? []} periodo={datos.rango} />
        </TituloAnalisis>
      );
    case "analisis-combustible-choferes":
      return (
        <TituloAnalisis titulo={def.label}>
          <ChoferRankingTable items={combustible.data?.porChofer ?? []} periodo={datos.rango} />
        </TituloAnalisis>
      );
    case "analisis-combustible-distribucion":
      return (
        <TituloAnalisis titulo={def.label}>
          <div className="grid gap-4 lg:grid-cols-2">
            <DistribucionPanel
              titulo="Por estación"
              items={combustible.data?.distribucionEstaciones ?? []}
              labelFor={(clave) => clave}
            />
            <DistribucionPanel
              titulo="Por forma de pago"
              items={combustible.data?.distribucionFormaPago ?? []}
              labelFor={fmtFormaPagoClave}
            />
          </div>
        </TituloAnalisis>
      );
    case "analisis-combustible-viajes":
      return (
        <TituloAnalisis titulo={def.label}>
          <ViajesCruceTable items={combustible.data?.viajesCruce ?? []} />
        </TituloAnalisis>
      );
    default:
      return null;
  }
}
