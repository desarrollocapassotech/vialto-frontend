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
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  tooltipFacturacionEstado,
  type FacturacionEstado,
} from "@/lib/viajesIndicadores";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { Spinner } from "@/components/ui/Spinner";
import { FacturaViewModal } from "@/components/facturacion/FacturaViewModal";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import type { Factura, Viaje } from "@/types/api";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtImporte(importe: number | null | undefined, moneda?: string | null) {
  if (importe == null) return "—";
  const prefix = moneda === "USD" ? "USD " : "$ ";
  return `${prefix}${importe.toLocaleString("es-AR")}`;
}

function Campo({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <p className="mt-1 text-sm">{value ?? "—"}</p>
    </div>
  );
}

export function ViajeFacturacionDetalleModal({
  viaje,
  onClose,
  tenantId,
}: {
  viaje: Pick<Viaje, "facturacionEstado" | "factura" | "cliente" | "clienteId">;
  onClose: () => void;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
}) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const estado = (viaje.facturacionEstado ?? "sin_facturar") as FacturacionEstado;
  const factura = viaje.factura;

  const [facturaCompleta, setFacturaCompleta] = useState<Factura | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);

  function facturaUrl(id: string) {
    return tenantId
      ? `/api/platform/facturas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
      : `/api/facturacion/facturas/${encodeURIComponent(id)}`;
  }

  async function abrirFacturaCompleta() {
    if (!factura) return;
    setCargando(true);
    setError(null);
    try {
      const full = await apiJson<Factura>(facturaUrl(factura.id), () => getToken());
      setFacturaCompleta(full);
    } catch (e) {
      setError(friendlyError(e, "facturacion"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <ViewModalShell
        title="Facturación del viaje"
        onClose={onClose}
        footer={
          <>
            <button type="button" onClick={onClose} className={viewModalBtnGhost}>
              Cerrar
            </button>
            {factura && (
              <button
                type="button"
                onClick={() => void abrirFacturaCompleta()}
                disabled={cargando}
                className={`inline-flex items-center gap-2 ${viewModalBtnPrimary}`}
              >
                {cargando && <Spinner className="h-3.5 w-3.5" />}
                {cargando ? "Abriendo…" : "Ver factura completa"}
              </button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <span
            className={`inline-block w-fit rounded-sm border font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider px-2 py-1 ${facturacionEstadoBadgeClass[estado]}`}
          >
            {facturacionEstadoLabel[estado] ?? estado}
          </span>
          <p className="text-sm text-vialto-charcoal">{tooltipFacturacionEstado(viaje)}</p>

          {factura ? (
            <div className={viewModalGridClass}>
              <Campo label="Número de factura" value={factura.numero} />
              <Campo label="Importe" value={fmtImporte(factura.importe, factura.moneda)} />
              {factura.fechaEmision && (
                <Campo label="Fecha de emisión" value={fmtDate(factura.fechaEmision)} />
              )}
              {factura.ptoVenta != null && (
                <Campo label="Punto de venta" value={factura.ptoVenta} />
              )}
              {factura.cbteNro != null && (
                <Campo label="Nº comprobante" value={factura.cbteNro} />
              )}
              {factura.cae && <Campo label="CAE" value={factura.cae} />}
              {factura.caeFechaVto && (
                <Campo label="Vencimiento CAE" value={fmtDate(factura.caeFechaVto)} />
              )}
            </div>
          ) : (
            <p className="text-sm text-vialto-steel/70">
              Todavía no hay ninguna factura vinculada a este viaje.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </p>
          )}
        </div>
      </ViewModalShell>

      {facturaCompleta && (
        <FacturaViewModal
          factura={facturaCompleta}
          clienteNombre={viaje.cliente?.nombre}
          onClose={() => setFacturaCompleta(null)}
          onEditar={() => {
            navigate("/facturacion", {
              state: {
                ...(tenantId ? { tenantId } : {}),
                expandFacturaId: facturaCompleta.id,
              },
            });
          }}
          onVerComprobante={
            facturaCompleta.comprobanteUrl?.trim()
              ? () => setComprobanteUrl(facturaCompleta.comprobanteUrl ?? null)
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
