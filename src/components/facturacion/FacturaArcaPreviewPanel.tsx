import { FacturaLineaDetalle } from "@/components/facturacion/FacturaLineaDetalle";
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
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import { DatosFiscalesFaltantesAlerta } from "@/components/shared/DatosFiscalesFaltantesAlerta";
import { SinConfigArcaAviso } from "@/components/facturacion/SinConfigArcaAviso";
import { EmisorArcaResumen } from "@/components/facturacion/EmisorArcaResumen";
import { ParteFacturaResumen } from "@/components/facturacion/ParteFacturaResumen";
import type { ArcaConfig, Cliente } from "@/types/api";
import { useHiddenFiscalFields, formatMissingFiscalField } from "@/hooks/useHiddenFiscalFields";
import { paisCodigoDesdeTexto, idFiscalPorPais } from "@/lib/ciudades/paises";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="text-vialto-steel">{label}</span>
      <span className="whitespace-nowrap tabular-nums text-vialto-charcoal">{value}</span>
    </div>
  );
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
}

// Fecha sin hora: siempre en UTC, si no en Argentina se ve un día antes (ver CLAUDE.md del frontend).
const fmtDate = fmtDateUtc;

export type FacturaArcaPreviewPanelProps = {
  arcaConfig: ArcaConfig | null;
  clienteDetalle: Cliente | null;
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
  /** true = el contenedor muestra el aviso de datos faltantes (fijo) y el form del cliente (modal); el panel no los repite. */
  avisoFaltantesExterno?: boolean;
  /** Línea debajo del nombre del receptor (ej. estado de la validación contra ARCA). */
  estadoReceptor?: ReactNode;
  feedbackSlot?: ReactNode;
};

export function FacturaArcaPreviewPanel({
  arcaConfig,
  clienteDetalle,
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
  avisoFaltantesExterno = false,
  estadoReceptor,
  feedbackSlot,
}: FacturaArcaPreviewPanelProps) {
  const condicionIva = clienteDetalle?.condicionIva ?? null;
  const letra = facturaLetraFromCondicionIva(condicionIva);
  const totales = computeFacturaTotales(lineas, ivaPctDefault);
  const missingClienteFields = missingEmitFields.filter((f) =>
    f.startsWith("Cliente:")
  );

  const missingHiddenFields = useHiddenFiscalFields(missingClienteFields);

  const paisCodigo = clienteDetalle?.pais ? paisCodigoDesdeTexto(clienteDetalle.pais) : "AR";
  const esExterior = Boolean(paisCodigo && paisCodigo !== "AR");

  const condicionLabel = esExterior
    ? clienteDetalle?.condicionTributaria?.trim() || "Cliente del Exterior"
    : condicionIvaLabel(condicionIva);

  const idFiscalLabel = idFiscalPorPais(paisCodigo).label;

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-vialto-steel">
          Tipo:
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
          {facturaLetraLabel(letra)}
        </span>
        <span className="text-xs text-vialto-steel">
          ({condicionLabel})
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <EmisorArcaResumen arcaConfig={arcaConfig} />
        <ParteFacturaResumen
          titulo="Receptor"
          nombre={clienteDetalle?.nombre}
          detalle={
            clienteDetalle
              ? [
                  condicionLabel,
                  clienteDetalle.idFiscal ? `${idFiscalLabel} ${clienteDetalle.idFiscal}` : null,
                  clienteDetalle.direccion?.trim(),
                  clienteDetalle.pais ? `País: ${clienteDetalle.pais}` : null,
                ]
                  .filter(Boolean)
                  .join("\n")
              : undefined
          }
          estado={estadoReceptor}
        />
      </div>

      {datosEmitIncompletos && !avisoFaltantesExterno && missingHiddenFields.length > 0 && (
        <div className="rounded border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
          <p className="font-semibold">Faltan datos fiscales requeridos por ARCA</p>
          <p className="mt-1">
            Faltan los siguientes datos del cliente: <strong>{missingClienteFields.map(formatMissingFiscalField).join(", ")}</strong>.
            <br />Hay campos ocultos que no se pueden editar. Por favor contactá al administrador para habilitarlos.
          </p>
        </div>
      )}

      <section className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
          Comprobante
        </p>
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
              <FacturaLineaDetalle
                key={idx}
                linea={linea}
                ivaPctDefault={ivaPctDefault}
                formatMonto={fmtMoney}
              />
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
        <div className="flex justify-between gap-3 text-xs font-semibold text-vialto-charcoal pt-1">
          <span>Total a facturar</span>
          <span className="whitespace-nowrap tabular-nums">{fmtMoney(totales.total)}</span>
        </div>
      </div>

      {sinConfigArca && <SinConfigArcaAviso platform={platform} />}

      {/* Con `avisoFaltantesExterno` el aviso de faltantes (y el form del cliente) los muestra el contenedor. */}
      {datosEmitIncompletos && !avisoFaltantesExterno && (
        <DatosFiscalesFaltantesAlerta
          missingEmitFields={
            clienteDetalle
              ? missingEmitFields
              : missingEmitFields.filter((f) => !f.startsWith("Cliente:"))
          }
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
