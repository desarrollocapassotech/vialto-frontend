import type { Viaje } from "@/types/api";
import { formatViajeImporteForListado } from "@/lib/viajesFlota";
import { useMaestroData } from "@/hooks/useMaestroData";
import { ViewModalShell } from "@/components/ui/ViewModalShell";
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  type FacturacionEstado,
} from "@/lib/viajesIndicadores";
import { FileText, ExternalLink } from "lucide-react";
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
    "inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5";
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
}: {
  viaje: Viaje;
  onClose: () => void;
  onVerFactura: (facturaId: string, clienteId: string) => void;
}) {
  const { clientes } = useMaestroData();

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
      facturacionEstado: "facturado",
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
      facturacionEstado: c.facturacionEstado,
    });
  }

  return (
    <ViewModalShell
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-vialto-blue" />
          Comprobantes Emitidos
        </div>
      }
      onClose={onClose}
      maxWidthClass="sm:max-w-4xl"
    >
      <div className="p-4 sm:p-6 bg-[#f8f9fa]">
        <p className="mb-4 text-sm text-vialto-steel">
          Este viaje tiene comprobantes emitidos para los siguientes clientes.
        </p>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-black/5 py-8 text-center text-sm text-vialto-steel">
            No hay facturas emitidas para este viaje.
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
                        Ver
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
