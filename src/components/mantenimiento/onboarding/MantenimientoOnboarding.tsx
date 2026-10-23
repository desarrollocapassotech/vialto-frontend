import { useState } from "react";
import { Check } from "lucide-react";
import type { PlanMantenimiento } from "@/types/mantenimiento";
import { PasoElegirPlanes } from "./PasoElegirPlanes";
import { PasoAsignarVehiculos } from "./PasoAsignarVehiculos";
import { PasoPrimeraOrden } from "./PasoPrimeraOrden";
import { OnboardingListo } from "./OnboardingListo";

const PASOS = ["Qué controlar", "A qué vehículos", "Primera orden"] as const;

/**
 * Configuración inicial de Mantenimiento (se muestra cuando la empresa no tiene planes):
 * 1) elegir planes, 2) asignarlos a vehículos, 3) primera orden de trabajo, y pantalla final.
 * Cada paso guarda al continuar; los pasos quedan montados para conservar lo elegido al volver.
 */
export function MantenimientoOnboarding({
  getToken,
  tenantId,
  onTerminar,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  /** Terminó (o salió desde la pantalla final): la página vuelve a las pestañas. */
  onTerminar: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [planes, setPlanes] = useState<PlanMantenimiento[]>([]);
  const [resumen, setResumen] = useState({ planes: 0, vehiculos: 0 });
  const [ordenRegistrada, setOrdenRegistrada] = useState(false);

  return (
    <div className="mx-auto mt-6 grid max-w-5xl gap-6">
      {paso < PASOS.length && (
        <ol className="flex items-center gap-2" aria-label="Pasos">
          <li className="text-xs text-vialto-steel sm:hidden">
            Paso {paso + 1} de {PASOS.length}: <span className="text-vialto-charcoal">{PASOS[paso]}</span>
          </li>
          {PASOS.map((label, i) => {
            const hecho = i < paso;
            const actual = i === paso;
            return (
              <li key={label} className="hidden flex-1 items-center gap-2 sm:flex">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    hecho ? "bg-emerald-600 text-white" : actual ? "bg-vialto-fire text-white" : "border border-black/20 text-vialto-steel"
                  }`}
                >
                  {hecho ? <Check className="h-4 w-4" strokeWidth={2.5} /> : i + 1}
                </span>
                <span className={`text-sm ${actual ? "font-medium text-vialto-charcoal" : "text-vialto-steel"}`}>{label}</span>
                {i < PASOS.length - 1 && <span className="mx-2 h-px flex-1 bg-black/15" aria-hidden />}
              </li>
            );
          })}
        </ol>
      )}

      <div className={paso === 0 ? "" : "hidden"}>
        <PasoElegirPlanes
          getToken={getToken}
          tenantId={tenantId}
          onContinuar={(p) => {
            setPlanes(p);
            setPaso(1);
          }}
        />
      </div>
      {planes.length > 0 && (
        <div className={paso === 1 ? "" : "hidden"}>
          <PasoAsignarVehiculos
            planes={planes}
            getToken={getToken}
            tenantId={tenantId}
            onVolver={() => setPaso(0)}
            onContinuar={(r) => {
              setResumen(r);
              setPaso(2);
            }}
          />
        </div>
      )}
      {paso === 2 && (
        <PasoPrimeraOrden
          getToken={getToken}
          tenantId={tenantId}
          onVolver={() => setPaso(1)}
          onContinuar={(registrada) => {
            setOrdenRegistrada(registrada);
            setPaso(3);
          }}
        />
      )}
      {paso === 3 && (
        <OnboardingListo
          planes={resumen.planes}
          vehiculos={resumen.vehiculos}
          ordenRegistrada={ordenRegistrada}
          onTerminar={onTerminar}
        />
      )}
    </div>
  );
}
