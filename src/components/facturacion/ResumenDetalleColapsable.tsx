import { PanelRightClose, PanelRightOpen } from "lucide-react";

export type ResumenTotalFila = { label: string; value: string };

const toggleClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-black/15 bg-white px-3 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal";

/** Abre el panel de detalle (arriba a la derecha del formulario mientras está oculto). */
export function VerDetalleButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={toggleClass}>
      <PanelRightOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
      Ver detalle
    </button>
  );
}

/**
 * Barra fija con los totales del comprobante, visible mientras el panel de detalle
 * ("Nueva factura" / "Nueva liquidación") está oculto.
 */
export function ResumenTotalesBarra({
  filas,
  total,
}: {
  filas: ResumenTotalFila[];
  total: ResumenTotalFila | null;
}) {
  return (
    <div className="flex shrink-0 items-center justify-end border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-1 text-xs">
        {filas.map((f) => (
          <span key={f.label} className="whitespace-nowrap">
            <span className="text-vialto-steel">{f.label}</span>{" "}
            <span className="tabular-nums text-vialto-charcoal">{f.value}</span>
          </span>
        ))}
        {total && (
          <span className="whitespace-nowrap text-sm font-semibold text-vialto-charcoal">
            {total.label} <span className="tabular-nums">{total.value}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Encabezado del panel de detalle abierto, con el botón para ocultarlo. */
export function DetalleComprobanteEncabezado({ onOcultar }: { onOcultar: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs uppercase tracking-wider text-vialto-steel">Detalle del comprobante</p>
      <button type="button" onClick={onOcultar} className={toggleClass}>
        <PanelRightClose className="h-3.5 w-3.5" strokeWidth={1.75} />
        Ocultar
      </button>
    </div>
  );
}
