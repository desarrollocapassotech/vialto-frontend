import type { Cliente, Transportista } from "@/types/api";
import { CompletarDatosFiscalesInline } from "@/components/shared/CompletarDatosFiscalesInline";

export type DatosFiscalesFaltantesAlertaProps = {
  missingEmitFields: string[];
  clienteDetalle?: Cliente | null;
  onClienteUpdated?: (c: Cliente) => void;
  transportistaSeleccionado?: Partial<Transportista> | null;
  onTransportistaUpdated?: (t: Transportista) => void;
  tenantId?: string;
  getToken?: () => Promise<string | null>;
};

export function DatosFiscalesFaltantesAlerta({
  missingEmitFields,
  clienteDetalle,
  onClienteUpdated,
  transportistaSeleccionado,
  onTransportistaUpdated,
  tenantId,
  getToken,
}: DatosFiscalesFaltantesAlertaProps) {
  if (missingEmitFields.length === 0) return null;

  const showCliente =
    clienteDetalle?.id &&
    onClienteUpdated &&
    getToken &&
    missingEmitFields.some((f) => f.startsWith("Cliente:"));

  const showTransportista =
    transportistaSeleccionado?.id &&
    onTransportistaUpdated &&
    getToken &&
    missingEmitFields.some((f) => f.startsWith("Transportista:"));

  return (
    <>
      <div
        className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        role="alert"
      >
        <p className="font-medium">Completá estos datos antes de emitir</p>
        <ul className="mt-1 list-disc pl-4 space-y-0.5">
          {missingEmitFields.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      {showTransportista && (
        <div className="mt-3 bg-white p-3 border rounded border-amber-200">
          <p className="font-medium text-amber-800 mb-2">Datos del transportista</p>
          <CompletarDatosFiscalesInline
            entidad="transportista"
            id={transportistaSeleccionado.id!}
            tenantId={tenantId}
            getToken={getToken}
            forceArcaFields={true}
            initial={{
              nombre: transportistaSeleccionado.nombre ?? "",
              pais: transportistaSeleccionado.pais ?? null,
              idFiscal: transportistaSeleccionado.idFiscal ?? null,
              condicionIva: transportistaSeleccionado.condicionIva ?? null,
              condicionTributaria:
                transportistaSeleccionado.condicionTributaria ?? null,
              direccion: transportistaSeleccionado.domicilio ?? null,
            }}
            onSaved={(t) => onTransportistaUpdated(t as Transportista)}
          />
        </div>
      )}

      {showCliente && (
        <div className="mt-3 bg-white p-3 border rounded border-amber-200">
          <p className="font-medium text-amber-800 mb-2">Datos del cliente</p>
          <CompletarDatosFiscalesInline
            entidad="cliente"
            id={clienteDetalle.id}
            tenantId={tenantId}
            getToken={getToken}
            forceArcaFields={true}
            initial={{
              nombre: clienteDetalle.nombre ?? "",
              pais: clienteDetalle.pais ?? null,
              idFiscal: clienteDetalle.idFiscal ?? null,
              condicionIva: clienteDetalle.condicionIva ?? null,
              condicionTributaria: clienteDetalle.condicionTributaria ?? null,
              direccion: clienteDetalle.direccion ?? null,
            }}
            onSaved={(c) => onClienteUpdated(c as Cliente)}
          />
        </div>
      )}
    </>
  );
}
