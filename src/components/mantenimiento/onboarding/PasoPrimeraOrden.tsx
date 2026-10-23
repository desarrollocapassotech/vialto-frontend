import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { OrdenTrabajoModal } from "@/components/mantenimiento/OrdenTrabajoModal";
import { BTN_CONTINUAR, BTN_LINK, BTN_VOLVER } from "./onboardingEstilos";

/** Paso 3: registrar la primera orden de trabajo (opcional). */
export function PasoPrimeraOrden({
  getToken,
  tenantId,
  onVolver,
  onContinuar,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onVolver: () => void;
  onContinuar: (registrada: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-medium text-vialto-charcoal">Registrá tu primera orden de trabajo</h2>
        
      </div>

      <div className="flex items-start gap-4 border border-black/10 bg-white p-4">
        <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-vialto-fire" strokeWidth={1.5} aria-hidden />
        <div className="text-sm text-vialto-charcoal">
          <p className="font-medium">Ejemplo</p>
          <p className="mt-1 text-vialto-steel">
            "Ayer le cambiamos el aceite al AB123CD con 480.000 km" → orden del vehículo AB123CD, fecha de ayer, km
            480.000, tildás "Service motor". El próximo service queda a los 500.000 km.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-black/10 pt-4">
        <button type="button" onClick={onVolver} className={`${BTN_VOLVER} mr-auto`}>
          Volver
        </button>
        <button type="button" onClick={() => onContinuar(false)} className={BTN_LINK}>
          Lo hago después
        </button>
        <button type="button" onClick={() => setAbierto(true)} className={BTN_CONTINUAR}>
          Registrar orden de trabajo
        </button>
      </div>

      {abierto && (
        <OrdenTrabajoModal
          estado={{ modo: "crear" }}
          soloLectura={false}
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setAbierto(false)}
          onGuardada={() => {
            setAbierto(false);
            onContinuar(true);
          }}
        />
      )}
    </div>
  );
}
