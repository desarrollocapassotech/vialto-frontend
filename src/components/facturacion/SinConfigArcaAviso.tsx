/**
 * Aviso cuando el tenant no tiene configuración ARCA. No bloquea: sin
 * configuración el tenant está en homologación y el backend emite igual, con
 * datos de emisor de prueba (ver `ArcaConfigService.configHomologacionPorDefecto`).
 * La configuración solo hace falta para emitir en producción.
 */
export function SinConfigArcaAviso({ platform = false }: { platform?: boolean }) {
  return (
    <div
      className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
      role="status"
    >
      <p className="font-medium">Ambiente de homologación (pruebas)</p>
      <p className="mt-1">
        Se emite con datos de emisor de prueba, sin validez fiscal. Para emitir en
        producción, completá la configuración en{" "}
        {platform ? "Superadmin → ARCA / AFIP" : "Configuración ARCA"}.
      </p>
    </div>
  );
}
