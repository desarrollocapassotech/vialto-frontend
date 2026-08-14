import type { ReactNode } from "react";
import {
  FacturaLineasEditor,
  computeFacturaTotales,
  type FacturaLineaDraft,
} from "@/components/facturacion/FacturaLineasEditor";
import {
  condicionIvaLabel,
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
} from "@/lib/arcaCbteTipo";
import { MSG_ARCA_NO_FACTURA_USD } from "@/lib/arcaUsdRestriction";
import { DatosFiscalesFaltantesAlerta } from "@/components/shared/DatosFiscalesFaltantesAlerta";
import type { ArcaConfig, Cliente } from "@/types/api";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-vialto-steel">{label}</span>
      <span className="tabular-nums text-vialto-charcoal">{value}</span>
    </div>
  );
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type FacturaArcaPreviewPanelProps = {
  arcaConfig: ArcaConfig | null;
  clienteDetalle: Cliente | null;
  datosReady: boolean;
  numero: string;
  fechaEmision: string;
  lineas: FacturaLineaDraft[];
  onLineasChange: (next: FacturaLineaDraft[]) => void;
  ivaPctDefault: number;
  lineasIncomplete?: number[];
  lineasDisabled?: boolean;
  bloqueadoUsd?: boolean;
  missingEmitFields?: string[];
  sinConfigArca?: boolean;
  datosEmitIncompletos?: boolean;
  platform?: boolean;
  tenantId?: string;
  getToken?: () => Promise<string | null>;
  onClienteUpdated?: (c: Cliente) => void;
  feedbackSlot?: ReactNode;
};

export function FacturaArcaPreviewPanel({
  arcaConfig,
  clienteDetalle,
  datosReady,
  numero,
  fechaEmision,
  lineas,
  onLineasChange,
  ivaPctDefault,
  lineasIncomplete = [],
  lineasDisabled = false,
  bloqueadoUsd = false,
  missingEmitFields = [],
  sinConfigArca = false,
  datosEmitIncompletos = false,
  platform = false,
  tenantId,
  getToken,
  onClienteUpdated,
  feedbackSlot,
}: FacturaArcaPreviewPanelProps) {
  const condicionIva = clienteDetalle?.condicionIva ?? null;
  const letra = facturaLetraFromCondicionIva(condicionIva);
  const totales = computeFacturaTotales(lineas, ivaPctDefault);

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
        Vista previa del comprobante
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-vialto-steel">
          Tipo:
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
          {facturaLetraLabel(letra)}
        </span>
        <span className="text-xs text-vialto-steel">
          ({condicionIvaLabel(condicionIva)})
        </span>
      </div>

      <section className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
          Emisor
        </p>
        <p className="text-sm text-vialto-charcoal font-medium">
          {arcaConfig?.razonSocial ?? "—"}
        </p>
        <p className="text-xs text-vialto-steel">
          CUIT {arcaConfig?.cuitEmisor ?? "—"}
          {arcaConfig?.domicilioEmisor
            ? ` · ${arcaConfig.domicilioEmisor}`
            : ""}
        </p>
        {arcaConfig && (
          <p className="text-xs text-vialto-steel">
            Ing. Brutos: {arcaConfig.ingBrutos?.trim() || "—"}
            {" · "}
            Inic. act.: {arcaConfig.inicActEmisor?.trim() || "—"}
          </p>
        )}
      </section>

      <section className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
          Receptor (cliente)
        </p>
        <p className="text-sm text-vialto-charcoal font-medium">
          {clienteDetalle?.nombre ?? "—"}
        </p>
        <p className="text-xs text-vialto-steel">
          {condicionIvaLabel(condicionIva)}
          {clienteDetalle?.idFiscal ? ` · CUIT ${clienteDetalle.idFiscal}` : ""}
        </p>
        {clienteDetalle?.direccion && (
          <p className="text-xs text-vialto-steel">
            {clienteDetalle.direccion}
          </p>
        )}
        {clienteDetalle?.pais && (
          <p className="text-xs text-vialto-steel">
            País: {clienteDetalle.pais}
          </p>
        )}
        {datosReady && condicionIva == null && clienteDetalle && (
          <p
            className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-2 py-1.5 mt-1"
            role="alert"
          >
            Falta la condición de IVA AFIP. Editá el cliente, seleccioná{" "}
            <strong>Argentina</strong> como país y guardá la condición frente al
            IVA.
          </p>
        )}
      </section>

      <section className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
          Comprobante
        </p>
        <Row label="Número local" value={numero.trim() || "—"} />
        <Row label="Fecha de emisión" value={fmtDate(fechaEmision)} />
      </section>

      {bloqueadoUsd && (
        <p
          className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-3 py-2"
          role="alert"
        >
          {MSG_ARCA_NO_FACTURA_USD}
        </p>
      )}

      {/* Si las líneas están deshabilitadas mostramos el detalle fijo, sino el editor */}
      <section className="space-y-1.5">
        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
          Detalles del viaje
        </p>
        {lineasDisabled ? (
          <div className="space-y-3 pt-1">
            {lineas.map((linea, idx) => (
              <div
                key={idx}
                className="flex justify-between items-start text-sm"
              >
                <div className="text-vialto-charcoal pr-4 whitespace-pre-wrap">
                  {linea.descripcion || "Sin descripción"}
                </div>
                <div className="text-right shrink-0">
                  <div className="tabular-nums font-medium text-vialto-charcoal">
                    {fmtMoney(linea.importe || 0)}
                  </div>
                  <div className="text-xs text-vialto-steel tabular-nums mt-0.5">
                    IVA: {linea.ivaPct ?? ivaPctDefault}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="pt-1">
            <FacturaLineasEditor
              lineas={lineas}
              onChange={(next) => onLineasChange(next)}
              ivaPctDefault={ivaPctDefault}
              disabled={lineasDisabled}
              incompleteIndices={lineasIncomplete}
            />
          </div>
        )}
      </section>

      <div className="space-y-1 border-t border-black/10 pt-2">
        <Row label="Neto" value={fmtMoney(totales.neto)} />
        <Row label="IVA" value={fmtMoney(totales.iva)} />
        <div className="flex justify-between text-xs font-semibold text-vialto-charcoal pt-1">
          <span>Total a facturar</span>
          <span className="tabular-nums">{fmtMoney(totales.total)}</span>
        </div>
      </div>

      {sinConfigArca && (
        <div
          className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="alert"
        >
          <p className="font-medium">Falta configuración ARCA del tenant</p>
          <p className="mt-1">
            {platform
              ? "Completala en Superadmin → ARCA / AFIP antes de emitir."
              : "Completala en Configuración ARCA antes de emitir."}
          </p>
        </div>
      )}

      {datosEmitIncompletos && !sinConfigArca && (
        <DatosFiscalesFaltantesAlerta
          missingEmitFields={missingEmitFields}
          clienteDetalle={clienteDetalle}
          onClienteUpdated={onClienteUpdated}
          tenantId={tenantId}
          getToken={getToken}
        />
      )}

      {feedbackSlot}
    </div>
  );
}
