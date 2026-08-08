import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import {
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from "@/lib/viajesIndicadores";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { Spinner } from "@/components/ui/Spinner";
import {
  LiquidacionViewModal,
  type LiquidacionConTransportista,
} from "@/components/liquidaciones/LiquidacionViewModal";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import type { Viaje } from "@/types/api";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtImporte(importe: number | null | undefined) {
  if (importe == null) return "—";
  return `$ ${importe.toLocaleString("es-AR")}`;
}

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value ?? "—"}</p>
    </div>
  );
}

export function ViajeLiquidacionDetalleModal({
  viaje,
  onClose,
  tenantId,
}: {
  viaje: Pick<Viaje, "liquidacionEstado" | "liquidacionesViaje">;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const estado = viaje.liquidacionEstado as LiquidacionEstado | null;
  const relevantes = viaje.liquidacionesViaje ?? [];
  const activa = relevantes.find((lv) => lv.liquidacion.estado !== "anulado");
  const elegida = (activa ?? relevantes[relevantes.length - 1])?.liquidacion;

  const [liquidacionCompleta, setLiquidacionCompleta] =
    useState<LiquidacionConTransportista | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);

  function liquidacionUrl(id: string) {
    const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
    return `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}${q}`;
  }

  async function abrirLiquidacionCompleta() {
    if (!elegida) return;
    setCargando(true);
    setError(null);
    try {
      const full = await apiJson<LiquidacionConTransportista>(
        liquidacionUrl(elegida.id),
        () => getToken(),
      );
      setLiquidacionCompleta(full);
    } catch (e) {
      setError(friendlyError(e, "liquidaciones"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <ViewModalShell
        title="Liquidación al transportista"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className={viewModalBtnGhost}>
              Cerrar
            </button>
            {elegida && (
              <button
                type="button"
                onClick={() => void abrirLiquidacionCompleta()}
                disabled={cargando}
                className={`inline-flex items-center gap-2 ${viewModalBtnPrimary}`}
              >
                {cargando && <Spinner className="h-3.5 w-3.5" />}
                {cargando ? "Abriendo…" : "Ver liquidación completa"}
              </button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {estado ? (
            <span
              className={`inline-block w-fit rounded-sm border font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1 ${liquidacionEstadoBadgeClass[estado]}`}
            >
              {liquidacionEstadoLabel[estado] ?? estado}
            </span>
          ) : (
            <span className="inline-block w-fit rounded-sm border bg-zinc-100 text-zinc-800 border-zinc-300/90 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1">
              No aplica
            </span>
          )}
          <p className="text-sm text-vialto-charcoal">
            {estado ? tooltipLiquidacionEstado(viaje) : "Este viaje no tiene transportista externo o el tenant no tiene integración ARCA."}
          </p>

          {elegida ? (
            <div className={viewModalGridClass}>
              <Campo label="Líquido a pagar" value={fmtImporte(elegida.liquido)} />
              {elegida.ptoVenta != null && (
                <Campo label="Punto de venta" value={elegida.ptoVenta} />
              )}
              {elegida.cbteNro != null && (
                <Campo label="Nº comprobante" value={elegida.cbteNro} />
              )}
              {elegida.cae && <Campo label="CAE" value={elegida.cae} />}
              {elegida.caeFechaVto && (
                <Campo label="Vencimiento CAE" value={fmtDate(elegida.caeFechaVto)} />
              )}
              {elegida.periodoDesde && elegida.periodoHasta && (
                <Campo
                  label="Período liquidado"
                  value={`${fmtDate(elegida.periodoDesde)} — ${fmtDate(elegida.periodoHasta)}`}
                />
              )}
              {elegida.motivoAnulacion && (
                <Campo label="Motivo de anulación" value={elegida.motivoAnulacion} />
              )}
            </div>
          ) : (
            estado && (
              <p className="text-sm text-vialto-steel/70">
                Todavía no hay ninguna liquidación vinculada a este viaje.
              </p>
            )
          )}

          {error && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
        </div>
      </ViewModalShell>

      {liquidacionCompleta && (
        <LiquidacionViewModal
          liq={liquidacionCompleta}
          ivaPct={liquidacionCompleta.ivaPct ?? undefined}
          hasArca
          canEdit={["borrador", "error", "pendiente_cae"].includes(liquidacionCompleta.estado)}
          onClose={() => setLiquidacionCompleta(null)}
          onEditar={() => {
            const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
            navigate(`/liquidaciones${params}`);
          }}
          onVerComprobante={
            liquidacionCompleta.comprobanteUrl?.trim()
              ? () => setComprobanteUrl(liquidacionCompleta.comprobanteUrl ?? null)
              : undefined
          }
        />
      )}

      {comprobanteUrl && (
        <AdjuntoPreviewModal
          url={comprobanteUrl}
          title="Comprobante"
          onClose={() => setComprobanteUrl(null)}
        />
      )}
    </>
  );
}
