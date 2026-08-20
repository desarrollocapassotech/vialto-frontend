import { useState } from "react";
import {
  isAfipInfrastructureError,
  MSG_AFIP_INFRA,
} from "@/lib/arcaFriendlyError";

/**
 * Cartel para fallas 5xx de infraestructura AFIP (501 CabInsert, etc.).
 * Deja claro que no es un error de datos del comprobante.
 */
export function AfipInfraErrorBanner({
  message = MSG_AFIP_INFRA,
}: {
  message?: string;
}) {
  return (
    <div
      className="border border-amber-400/40 bg-amber-50 px-3 py-2.5 text-xs text-amber-900"
      role="alert"
    >
      <p className="font-medium">Problema temporal de AFIP</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}

/** Error de emisión ARCA: cartel ámbar si es infra AFIP; rojo si es otro rechazo. */
export function ArcaEmitErrorAlert({ error }: { error: string }) {
  if (isAfipInfrastructureError(error)) {
    return <AfipInfraErrorBanner message={MSG_AFIP_INFRA} />;
  }
  return (
    <p
      className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
      role="alert"
    >
      {error}
    </p>
  );
}

/**
 * Muestra un mensaje de error amigable de ARCA y, si hay detalle técnico
 * (respuesta cruda de AFIP SDK), un botón para ver el error completo y copiarlo.
 */
export function ArcaErrorMessage({
  message,
  detalle,
  className,
  align = "left",
}: {
  message: string;
  detalle?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const infra = isAfipInfrastructureError(message);

  async function copiar() {
    const texto = detalle ? `${message}\n\n${detalle}` : message;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard no disponible: ignorar */
    }
  }

  if (infra) {
    return (
      <div
        className={`${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}
      >
        <AfipInfraErrorBanner />
        {detalle && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-[11px] text-amber-900 underline hover:text-amber-950"
            >
              {open ? "Ocultar error completo" : "Ver error completo"}
            </button>
            {open && (
              <div className="mt-1 text-left">
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-amber-200 bg-amber-50/80 p-2 text-[11px] leading-snug text-amber-950">
                  {detalle}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}
    >
      <p className="text-red-700">{message}</p>
      {detalle && (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-[11px] text-red-700 underline hover:text-red-800"
          >
            {open ? "Ocultar error completo" : "Ver error completo"}
          </button>
          {open && (
            <div className="mt-1 text-left">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-red-200 bg-red-50 p-2 text-[11px] leading-snug text-red-900">
                {detalle}
              </pre>
              <button
                type="button"
                onClick={() => void copiar()}
                className="mt-1 text-[11px] text-red-700 underline hover:text-red-800"
              >
                {copiado ? "¡Copiado!" : "Copiar error"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
