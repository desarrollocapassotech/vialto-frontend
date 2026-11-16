import type { Viaje } from "@/types/api";
import { formatViajeImporteForListado } from "@/lib/viajesFlota";
import { useMaestroData } from "@/hooks/useMaestroData";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import {
  viajePendienteComprobanteCliente,
  viajeTieneMontoCliente,
} from "@/lib/viajesComprobantes";
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  getVisualFacturacionEstado,
  type FacturacionEstado,
} from "@/lib/viajesIndicadores";
import { AlertTriangle, ExternalLink, FileText } from "lucide-react";
import { importeNetoViajeParaFactura } from "@/lib/facturaTotales";

interface FacturaRow {
  clienteId: string;
  nombre: string;
  origen: string;
  destino: string;
  montoStr: string;
  facturaId: string | null;
  facturacionEstado: string;
}

function FacturacionBadge({ estado }: { estado: FacturacionEstado }) {
  const badgeClass =
    "inline-block rounded-sm border text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5 whitespace-nowrap";
  return (
    <span className={`${badgeClass} ${facturacionEstadoBadgeClass[estado]}`}>
      {facturacionEstadoLabel[estado] || estado}
    </span>
  );
}

export function VerFacturasMultiClienteModal({
  viaje,
  onClose,
  onVerFactura,
  onFacturar,
}: {
  viaje: Viaje;
  onClose: () => void;
  onVerFactura: (facturaId: string, clienteId: string) => void;
  onFacturar?: () => void;
}) {
  const { clientes } = useMaestroData();

  const tienePermisoFacturar = Boolean(onFacturar);
  const esCancelado = viaje.etapa?.toLowerCase() === "cancelado";
  const esFinalizado = viaje.etapa?.toLowerCase() === "finalizado";
  const tieneMontoCliente = viajeTieneMontoCliente(viaje);
  const pendienteFacturar = viajePendienteComprobanteCliente(viaje);

  let motivoBloqueo: string | null = null;
  if (esCancelado) {
    motivoBloqueo = "No se puede facturar porque el viaje está cancelado.";
  } else if (!esFinalizado && !tieneMontoCliente) {
    motivoBloqueo =
      "No se puede facturar: el viaje debe estar en etapa Finalizado y tener cargado el monto del cliente.";
  } else if (!esFinalizado) {
    motivoBloqueo = "Para facturar, el viaje debe estar en etapa Finalizado.";
  } else if (!tieneMontoCliente) {
    motivoBloqueo = "No se puede facturar el viaje: falta cargar el monto del cliente.";
  }

  const listoParaFacturar =
    tienePermisoFacturar &&
    !esCancelado &&
    esFinalizado &&
    tieneMontoCliente &&
    pendienteFacturar;

  const rows: FacturaRow[] = [];

  const cPrincipal =
    viaje.cliente?.nombre?.trim() ||
    clientes?.find((x) => x.id === viaje.clienteId)?.nombre?.trim() ||
    "—";

  const principalDestino = viaje.destinosViaje?.length 
    ? viaje.destinosViaje[viaje.destinosViaje.length - 1].etiqueta 
    : (viaje.destino || "—");

  if (viaje.facturaId) {
    rows.push({
      clienteId: viaje.clienteId,
      nombre: cPrincipal,
      origen: viaje.origen || "—",
      destino: principalDestino,
      montoStr: formatViajeImporteForListado(
        importeNetoViajeParaFactura(viaje),
        viaje.monedaMonto
      ),
      facturaId: viaje.facturaId,
      // override visual a borrador si hay facturaId pero el estado de BD sigue siendo sin_facturar
      facturacionEstado: getVisualFacturacionEstado(viaje.facturacionEstado, viaje.facturaId),
    });
  }

  for (const c of viaje.clientesViaje ?? []) {
    if (!c.facturaId) continue;
    
    const nombre =
      c.cliente?.nombre?.trim() ||
      clientes?.find((x) => x.id === c.clienteId)?.nombre?.trim() ||
      "—";
      
    const destino = c.destinosCliente?.length
      ? c.destinosCliente[c.destinosCliente.length - 1].etiqueta
      : (c.destino || "—");

    if (rows.some(r => r.facturaId === c.facturaId)) {
      continue;
    }

    rows.push({
      clienteId: c.clienteId,
      nombre,
      origen: c.origen || "—",
      destino,
      montoStr: formatViajeImporteForListado(
        importeNetoViajeParaFactura({
          monto: c.monto,
          cantidadFactura: c.cantidad,
          precioUnitarioFactura: c.precioUnitario
        }),
        c.monedaMonto
      ),
      facturaId: c.facturaId,
      // override visual a borrador si hay facturaId pero el estado de BD sigue siendo sin_facturar
      facturacionEstado: getVisualFacturacionEstado(c.facturacionEstado, c.facturaId),
    });
  }

  return (
    <ViewModalShell
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-vialto-blue" />
          Facturas del Viaje
        </div>
      }
      onClose={onClose}
      maxWidthClass="sm:max-w-4xl"
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {tienePermisoFacturar && pendienteFacturar && (
            <button
              type="button"
              disabled={!listoParaFacturar}
              title={motivoBloqueo ?? undefined}
              onClick={() => {
                if (!listoParaFacturar) return;
                onClose();
                onFacturar?.();
              }}
              className={`${viewModalBtnPrimary} disabled:cursor-not-allowed`}
            >
              Facturar
            </button>
          )}
        </>
      }
    >
      <div className="p-4 sm:p-6 bg-[#f8f9fa]">
        <p className="mb-4 text-sm text-vialto-steel">
          Este viaje tiene las siguientes facturas vinculadas a sus clientes (borradores o emitidos).
        </p>

        {motivoBloqueo && tienePermisoFacturar && pendienteFacturar && (
          <div className="mb-4 flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{motivoBloqueo}</span>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-black/5 py-8 text-center text-sm text-vialto-steel">
            <p>No hay facturas vinculadas a este viaje.</p>
            {listoParaFacturar && (
              <p className="mt-1 text-xs text-vialto-steel/80">
                Podés iniciar la facturación seleccionando el cliente a facturar.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-vialto-navy/5 text-xs font-semibold uppercase tracking-wider text-vialto-navy">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Tramo (Origen - Destino)</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className="transition-colors hover:bg-black/[0.02]"
                  >
                    <td className="px-4 py-4 font-medium text-vialto-navy">
                      {r.nombre}
                    </td>
                    <td className="px-4 py-4 text-vialto-steel">
                      {r.origen} <span className="mx-1 text-black/40">→</span> {r.destino}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-vialto-navy">
                      {r.montoStr}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <FacturacionBadge estado={r.facturacionEstado as any} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onVerFactura(r.facturaId!, r.clienteId);
                          onClose();
                        }}
                        className="inline-flex h-8 items-center justify-center rounded border border-vialto-blue/20 px-3 text-xs font-medium text-vialto-blue hover:bg-vialto-blue/5"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Ver factura
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}
