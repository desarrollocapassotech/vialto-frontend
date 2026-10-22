import { useState } from "react";
import { HandCoins } from "lucide-react";
import { EstadoIcono } from "@/components/viajes/EstadoIcono";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  glifoEstadoComprobante,
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from "@/lib/viajesIndicadores";
import { liquidacionElegidaDeViaje } from "@/lib/viajesComprobantes";
import { ViajeLiquidacionDetalleModal } from "@/components/viajes/ViajeLiquidacionDetalleModal";
import {
  LiquidacionViewModal,
  type LiquidacionConTransportista,
} from "@/components/liquidaciones/LiquidacionViewModal";
import { useAbrirAdjunto } from "@/hooks/useAbrirAdjunto";
import { apiFetch, apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { verPdfLiquidacion } from "@/lib/liquidacionContratoPdf";
import { useToast } from "@/lib/toast";
import type { Viaje } from "@/types/api";

type Props = {
  // Tipo completo: el modal de detalle (sin liquidación vinculada) necesita los
  // campos de pagosTransportista/precio para mostrar el resumen de pagos al transportista.
  viaje: Viaje;
  tenantId?: string;
  /** Tenant con emision-liquido-producto-arca: habilita los campos ARCA en el detalle. */
  hasArca?: boolean;
  /** Si se pasa, el modal de detalle (sin liquidación vinculada) habilita "+ Registrar pago". */
  onRegistrarPago?: () => void;
  /** Si se pasa, el modal de detalle (sin liquidación vinculada) ofrece "Liquidar". */
  onLiquidar?: () => void;
  /**
   * `icono`: ícono compacto de una sola línea (columna "Liquidación" de la grilla).
   * `link`: acción "Ver liquidación" (sección Liquidación del detalle del viaje); solo se
   * muestra si hay una liquidación vinculada.
   */
  variante?: "badge" | "icono" | "link";
  /**
   * Si se pasa, el detalle de una liquidación en borrador / con error ofrece "Emitir": se
   * cierra el detalle y el host abre el modal de "Nueva liquidación" sobre esa liquidación.
   */
  onEmitir?: (liq: LiquidacionConTransportista) => void;
  /** Config "ID Propio 2" de la empresa (superadmin); sin prop el modal usa la empresa propia. */
  idPropio2Habilitado?: boolean;
  idPropio2Label?: string;
};

const badgeClass =
  "inline-block whitespace-nowrap rounded-sm border text-left font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer hover:brightness-95 disabled:opacity-60 disabled:cursor-wait";

function liquidacionUrl(id: string, tenantId?: string) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  return `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}${q}`;
}

function liquidacionPdfUrl(
  id: string,
  kind: "pdf" | "pdf-anulacion",
  tenantId?: string,
) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  return `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}/${kind}${q}`;
}

export function ViajeLiquidacionIndicador({
  viaje,
  tenantId,
  hasArca = false,
  onRegistrarPago,
  onLiquidar,
  variante = "badge",
  onEmitir,
  idPropio2Habilitado,
  idPropio2Label,
}: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { abrirAdjunto, visorAdjunto } = useAbrirAdjunto();
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [liquidacionCompleta, setLiquidacionCompleta] =
    useState<LiquidacionConTransportista | null>(null);

  if (viaje.liquidacionEstado == null) return null;
  const estado = viaje.liquidacionEstado as LiquidacionEstado;
  const elegida = liquidacionElegidaDeViaje(viaje);
  if (variante === "link" && !elegida) return null;

  async function handleClick() {
    if (!elegida) {
      setOpen(true);
      return;
    }
    setCargando(true);
    try {
      const full = await apiJson<LiquidacionConTransportista>(
        liquidacionUrl(elegida.id, tenantId),
        () => getToken(),
      );
      setLiquidacionCompleta(full);
    } catch (e) {
      showToast(friendlyError(e, "liquidaciones"), "error");
    } finally {
      setCargando(false);
    }
  }

  /** Adjunto guardado (comprobante o anulación manual): foto en el visor, documento en pestaña nueva. */
  function verAdjunto(url: string | null | undefined, titulo = "Comprobante") {
    const u = url?.trim();
    if (u) abrirAdjunto({ url: u }, titulo);
  }

  async function verPdf(kind: "pdf" | "pdf-anulacion", errorMsg: string) {
    if (!liquidacionCompleta) return;
    const ventana = window.open("", "_blank");
    try {
      const res = await apiFetch(
        liquidacionPdfUrl(liquidacionCompleta.id, kind, tenantId),
        () => getToken(),
      );
      if (!res.ok) throw new Error(errorMsg);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = blobUrl;
      else window.open(blobUrl, "_blank");
    } catch (e) {
      ventana?.close();
      showToast(friendlyError(e, "arca"), "error");
    }
  }

  return (
    <>
      {variante === "link" ? (
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={cargando}
          className="text-[10px] uppercase tracking-[0.12em] text-vialto-fire hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          {cargando ? "Abriendo…" : "Ver liquidación"}
        </button>
      ) : variante === "icono" ? (
        <EstadoIcono
          icon={HandCoins}
          glifo={glifoEstadoComprobante(estado)}
          colorClass={liquidacionEstadoBadgeClass[estado] ?? ""}
          title={`Liquidación: ${tooltipLiquidacionEstado(viaje)}`}
          tachado={estado === "anulado"}
          onClick={() => void handleClick()}
          disabled={cargando}
        />
      ) : (
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={cargando}
          title={`Liquidación: ${tooltipLiquidacionEstado(viaje)}`}
          className={`${badgeClass} ${liquidacionEstadoBadgeClass[estado]}`}
        >
          {liquidacionEstadoLabel[estado] ?? estado}
        </button>
      )}
      {open && (
        <ViajeLiquidacionDetalleModal
          viaje={viaje}
          tenantId={tenantId}
          onRegistrarPago={onRegistrarPago}
          onLiquidar={onLiquidar}
          onClose={() => setOpen(false)}
        />
      )}
      {liquidacionCompleta && (
        <LiquidacionViewModal
          liq={liquidacionCompleta}
          idPropio2Habilitado={idPropio2Habilitado}
          idPropio2Label={idPropio2Label}
          ivaPct={liquidacionCompleta.ivaPct ?? undefined}
          hasArca={hasArca}
          canEdit={["borrador", "error", "pendiente_cae"].includes(
            liquidacionCompleta.estado,
          )}
          onClose={() => setLiquidacionCompleta(null)}
          onEmitir={
            onEmitir
              ? () => {
                  setLiquidacionCompleta(null);
                  onEmitir(liquidacionCompleta);
                }
              : undefined
          }
          onEditar={() => {
            const params = tenantId
              ? `?tenantId=${encodeURIComponent(tenantId)}`
              : "";
            navigate(`/liquidaciones${params}`);
          }}
          onVerComprobante={
            liquidacionCompleta.cbteNro != null
              ? () => void verPdf("pdf", "Error al generar el PDF")
              : liquidacionCompleta.comprobanteUrl?.trim()
                ? () => verAdjunto(liquidacionCompleta.comprobanteUrl)
                : undefined
          }
          onVerPdfLiquidacion={() =>
            void verPdfLiquidacion(liquidacionCompleta.id, () => getToken(), tenantId)
          }
          onVerAnulacion={
            liquidacionCompleta.estado === "anulado" &&
            liquidacionCompleta.anulacionMetodo !== "manual"
              ? () =>
                  void verPdf(
                    "pdf-anulacion",
                    "Error al generar el PDF de la anulación",
                  )
              : undefined
          }
          onVerComprobanteAnulacionManual={
            liquidacionCompleta.estado === "anulado" &&
            liquidacionCompleta.anulacionMetodo === "manual" &&
            liquidacionCompleta.anulacionManualComprobanteUrl
              ? () =>
                  verAdjunto(
                    liquidacionCompleta.anulacionManualComprobanteUrl,
                    "Comprobante de anulación",
                  )
              : undefined
          }
        />
      )}
      {visorAdjunto}
    </>
  );
}
