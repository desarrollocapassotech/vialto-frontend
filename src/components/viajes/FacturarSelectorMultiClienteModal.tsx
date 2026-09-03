import { useState } from "react";
import type { Viaje } from "@/types/api";
import { formatViajeImporteForListado } from "@/lib/viajesFlota";
import { useMaestroData } from "@/hooks/useMaestroData";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  type FacturacionEstado,
} from "@/lib/viajesIndicadores";
import { FileText, CheckCircle2 } from "lucide-react";
import { importeNetoViajeParaFactura } from "@/lib/facturaTotales";

interface ClienteRow {
  clienteId: string;
  nombre: string;
  origen: string;
  destino: string;
  carga: string;
  montoStr: string;
  facturacionEstado: string;
  yaFacturado: boolean;
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

import { facturacionPermiteVincular } from "@/lib/viajesIndicadores";

export function FacturarSelectorMultiClienteModal({
  viaje,
  onClose,
  onSelect,
}: {
  viaje: Viaje;
  onClose: () => void;
  onSelect: (clienteId: string) => void;
}) {
  const { clientes } = useMaestroData();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows: ClienteRow[] = [];

  const cPrincipal =
    viaje.cliente?.nombre?.trim() ||
    clientes?.find((x) => x.id === viaje.clienteId)?.nombre?.trim() ||
    "—";
    
  const principalFacturado = !facturacionPermiteVincular(viaje.facturacionEstado || 'sin_facturar');

  const principalDestino = viaje.destinosViaje?.length 
    ? viaje.destinosViaje[viaje.destinosViaje.length - 1].etiqueta 
    : (viaje.destino || "—");

  function formatProductos(productos?: any[]) {
    if (!productos || productos.length === 0) return null;
    return productos
      .map((p) => {
        const parts = [];
        if (p.cantidad) parts.push(`${p.cantidad}u`);
        if (p.pesoKg) parts.push(`${p.pesoKg}kg`);
        const metrics = parts.join(" ");
        return `${p.producto?.nombre || "Producto"}${metrics ? ` (${metrics})` : ""}`;
      })
      .join(", ");
  }

  rows.push({
    clienteId: viaje.clienteId,
    nombre: cPrincipal,
    origen: viaje.origen || "—",
    destino: principalDestino,
    carga: formatProductos(viaje.productosViaje) || viaje.detalleCarga || "—",
    montoStr: formatViajeImporteForListado(
      importeNetoViajeParaFactura(viaje),
      viaje.monedaMonto
    ),
    facturacionEstado: principalFacturado ? "facturado" : "sin_facturar",
    yaFacturado: principalFacturado,
  });

  for (const c of viaje.clientesViaje ?? []) {
    const nombre =
      c.cliente?.nombre?.trim() ||
      clientes?.find((x) => x.id === c.clienteId)?.nombre?.trim() ||
      "—";
      
    const destino = c.destinosCliente?.length
      ? c.destinosCliente[c.destinosCliente.length - 1].etiqueta
      : (c.destino || "—");
      
    const vcFacturado = !facturacionPermiteVincular(c.facturacionEstado || 'sin_facturar');

    rows.push({
      clienteId: c.clienteId,
      nombre,
      origen: c.origen || "—",
      destino,
      carga: formatProductos(c.productosCliente) || "—",
      montoStr: formatViajeImporteForListado(
        importeNetoViajeParaFactura({
          monto: c.monto,
          cantidadFactura: c.cantidad,
          precioUnitarioFactura: c.precioUnitario
        }),
        c.monedaMonto
      ),
      facturacionEstado: c.facturacionEstado,
      yaFacturado: vcFacturado,
    });
  }

  return (
    <ViewModalShell
      title={
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-vialto-blue" />
          Facturar Viaje Multi-Cliente
        </div>
      }
      onClose={onClose}
      maxWidthClass="sm:max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={viewModalBtnGhost}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!selectedId}
            onClick={() => {
              if (selectedId) {
                onSelect(selectedId);
                onClose();
              }
            }}
            className={viewModalBtnPrimary}
          >
            Siguiente
          </button>
        </>
      }
    >
      <div className="p-4 sm:p-6 bg-[#f8f9fa]">
        <p className="mb-4 text-sm text-vialto-steel">
          Este viaje incluye cargas para múltiples clientes. Seleccioná a qué cliente querés emitirle el comprobante.
        </p>

        <div className="overflow-x-auto rounded-xl border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-vialto-navy/5 text-xs font-semibold uppercase tracking-wider text-vialto-navy">
              <tr>
                <th className="px-4 py-3 w-12 text-center"></th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tramo (Origen - Destino)</th>
                <th className="px-4 py-3">Carga</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((r, i) => {
                const isSelected = selectedId === r.clienteId;
                return (
                  <tr
                    key={i}
                    onClick={() => {
                      if (!r.yaFacturado) setSelectedId(r.clienteId);
                    }}
                    className={`transition-colors ${
                      r.yaFacturado
                        ? "bg-black/[0.02] opacity-80 cursor-default"
                        : isSelected
                        ? "bg-black/10 cursor-pointer"
                        : "cursor-pointer hover:bg-black/[0.05]"
                    }`}
                  >
                    <td className="px-4 py-4 text-center align-middle w-12">
                      <div className="flex h-full w-full items-center justify-center">
                        {r.yaFacturado ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <input
                            type="radio"
                            name="clienteSeleccionado"
                            checked={isSelected}
                            readOnly
                            className="h-4 w-4 cursor-pointer text-vialto-navy focus:ring-vialto-navy border-gray-300"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-vialto-navy align-middle">
                      <span className={r.yaFacturado ? "line-through text-vialto-steel font-normal" : ""}>
                        {r.nombre}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-vialto-steel align-middle">
                      {r.origen} <span className="mx-1 text-black/40">→</span> {r.destino}
                    </td>
                    <td className="px-4 py-4 text-vialto-steel align-middle text-xs">
                      {r.carga}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-vialto-navy align-middle">
                      {r.montoStr}
                    </td>
                    <td className="px-4 py-4 text-center align-middle">
                      <FacturacionBadge estado={r.facturacionEstado as any} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ViewModalShell>
  );
}
