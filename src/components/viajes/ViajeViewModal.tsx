import { useEffect } from "react";
import { Banknote, Receipt } from "lucide-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { listadoTablaTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import {
  textoRutaViaje,
  etiquetasDestinosDesdeViaje,
} from "@/lib/viajesDestinos";
import { OtroGastoAutorDisplay } from "@/components/viajes/OtrosGastosFieldset";
import { useOrgUserLabels } from "@/hooks/useOrgUserLabels";
import type { Viaje } from "@/types/api";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { etapaViajeLabel, tooltipFacturacionEstado, tooltipLiquidacionEstado } from "@/lib/viajesIndicadores";
import { ViajeFacturacionIndicador } from "@/components/viajes/ViajeFacturacionIndicador";
import { ViajeLiquidacionIndicador } from "@/components/viajes/ViajeLiquidacionIndicador";
import { ViajeGananciaBrutaDetalle } from "@/components/viajes/ViajeGananciaBruta";
import { ViajePagoTransportistaIndicador } from "@/components/viajes/ViajePagoTransportistaIndicador";
import { numeroVisibleViaje, viajeUsaNumeroInterno } from "@/lib/viajesFlota";

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

export function ViajeViewModal({
  viaje,
  onClose,
  onEditar,
  tenantId,
  hasArca = false,
  editando = false,
  onFacturar,
  facturando = false,
  onLiquidar,
  liquidando = false,
  onRegistrarPago,
}: {
  viaje: Viaje;
  onClose: () => void;
  onEditar: () => void;
  /** Clerk org id para resolver nombres en vista superadmin. */
  tenantId?: string;
  /** Tenant con módulo integracion-arca activo: define si se muestra el badge de liquidación o el de pago al transportista. */
  hasArca?: boolean;
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

  const campos = [
    { key: "clienteId", label: "Cliente", value: clienteNombre },
    {
      key: "transportistaId",
      label: "Transportista",
      value: viaje.transportistaId ? transportistaNombre : "Flota propia",
    },
    {
      key: "origen",
      label: "Ruta",
      value: textoRutaViaje(viaje.origen, etiquetasDestinosDesdeViaje(viaje)),
    },
    {
      key: "fechaCarga",
      label: "Fecha de carga",
      value: viaje.fechaCarga ? fmtDate(viaje.fechaCarga) : null,
    },
    {
      key: "fechaDescarga",
      label: "Fecha de descarga",
      value: viaje.fechaDescarga ? fmtDate(viaje.fechaDescarga) : null,
    },
    { key: "vehiculosRows", label: "Vehículos", value: vehiculoPatentes },
    { key: "productoItems", label: "Productos", value: productosDesc },
    {
      key: "monto",
      label: "Monto cliente",
      value:
        viaje.monto != null ? fmtMonto(viaje.monto, viaje.monedaMonto) : null,
    },
    {
      key: "precioTransportistaExterno",
      label: "Precio transportista",
      value:
        viaje.precioTransportistaExterno != null
          ? fmtMonto(
              viaje.precioTransportistaExterno,
              viaje.monedaPrecioTransportistaExterno,
            ) +
            (viaje.precioTransportistaIvaIncluidoPct
              ? ` (IVA ${viaje.precioTransportistaIvaIncluidoPct}% incluido)`
              : "")
          : null,
    },
    { key: "kmRecorridos", label: "KM recorridos", value: viaje.kmRecorridos },
    {
      key: "litrosConsumidos",
      label: "Litros consumidos",
      value: viaje.litrosConsumidos,
    },
    {
      key: "fechaFinalizado",
      label: "Fecha finalizado",
      value: viaje.fechaFinalizado ? fmtDate(viaje.fechaFinalizado) : null,
    },
  ].filter(
    (c) =>
      c.value != null &&
      c.value !== "" &&
      isVisible("detalle_viaje", c.key),
  );

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
          <span className="text-xs uppercase tracking-[0.1em] border rounded px-2 py-0.5 text-vialto-steel border-black/15">
            {etapaViajeLabel[viaje.etapa] ?? viaje.etapa}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ViajeFacturacionIndicador viaje={viaje} tenantId={tenantId} />
            {hasArca ? (
              <ViajeLiquidacionIndicador viaje={viaje} tenantId={tenantId} />
            ) : (
              <ViajePagoTransportistaIndicador viaje={viaje} onClick={onRegistrarPago} />
            )}
          </span>
        </span>
      }
      onClose={bloqueado ? () => {} : onClose}
      maxWidthClass="sm:max-w-2xl"
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
                  <Receipt className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
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
                  <Banknote className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
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
          <div className={viewModalGridClass}>
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Facturación</p>
              <p className="mt-1 text-sm">{tooltipFacturacionEstado(viaje)}</p>
            </div>
            {viaje.liquidacionEstado != null && (
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Liquidación</p>
                <p className="mt-1 text-sm">{tooltipLiquidacionEstado(viaje)}</p>
              </div>
            )}
            {campos.map((c, i) => (
              <div key={i}>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  {c.label}
                </p>
                <p className="mt-1 text-sm">{c.value}</p>
              </div>
            ))}
            <ViajeGananciaBrutaDetalle viaje={viaje} onPagoClick={onRegistrarPago} />
          </div>
          {isVisible("detalle_viaje", "detalleCarga") && viaje.detalleCarga && (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Detalle de carga
              </p>
              <p className="mt-1 text-sm">{viaje.detalleCarga}</p>
            </div>
          )}
          {isVisible("detalle_viaje", "observaciones") && viaje.observaciones && (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Observaciones
              </p>
              <p className="mt-1 text-sm">{viaje.observaciones}</p>
            </div>
          )}
        </div>

        {isVisible("detalle_viaje", "otrosGastos") && (
          <div className="py-5">
            <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
              Gastos adicionales
              {viaje.otrosGastos && viaje.otrosGastos.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({viaje.otrosGastos.length})
                </span>
              )}
            </p>
            {!viaje.otrosGastos || viaje.otrosGastos.length === 0 ? (
              <p className="text-sm text-vialto-steel/70">Sin gastos registrados.</p>
            ) : (
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
                rowKey={(g) => `${g.descripcion ?? ""}-${g.fecha ?? ""}-${g.monto ?? ""}`}
                emptyMessage="Sin gastos registrados."
              />
            )}
          </div>
        )}

        {isVisible("detalle_viaje", "pagosTransportista") && (
          <div className="pt-5">
            <p className="text-xs uppercase tracking-[0.12em] text-vialto-steel mb-3">
              Pagos al transportista
              {viaje.pagosTransportista && viaje.pagosTransportista.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal">
                  ({viaje.pagosTransportista.length})
                </span>
              )}
            </p>
            {!viaje.pagosTransportista || viaje.pagosTransportista.length === 0 ? (
              <p className="text-sm text-vialto-steel/70">Sin pagos registrados.</p>
            ) : (
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
                rowKey={(p) => `${p.fecha ?? ""}-${p.metodo ?? ""}-${p.monto ?? ""}`}
                emptyMessage="Sin pagos registrados."
              />
            )}
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}
